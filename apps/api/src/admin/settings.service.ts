import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

/** Schéma všech nastavení. Výchozí hodnoty pocházejí z proměnných prostředí (záloha, když v DB nic není). */
export const SettingsSchema = z.object({
  premoderation: z.boolean(),
  listingDays: z.number().int().min(1, 'Platnost musí být alespoň 1 den.').max(365, 'Platnost může být nejvýše 365 dní.'),
  /** Nejvýše aktivních inzerátů zdarma pro soukromou osobu (0 = bez omezení). Firemní účty limit nemají. */
  freeActiveListings: z.number().int().min(0).max(100_000),
  maxListingsPerHour: z.number().int().min(1).max(1000),
  supportEmail: z.union([z.email('Zadejte platný e-mail podpory.'), z.literal('')]),
  supportPhone: z.string().trim().max(30),
  operatorName: z.string().trim().max(120),
  operatorIco: z.string().trim().regex(/^(\d{8})?$/, 'IČO má 8 číslic.'),
  operatorAddress: z.string().trim().max(200),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const PUBLIC_SETTING_KEYS = ['supportEmail', 'supportPhone', 'operatorName', 'operatorIco', 'operatorAddress', 'listingDays', 'freeActiveListings'] as const;

export function envDefaults(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    premoderation: config.premoderation,
    listingDays: config.listingDays,
    freeActiveListings: num(env.FREE_ACTIVE_LISTINGS, 0),
    maxListingsPerHour: num(env.MAX_LISTINGS_PER_HOUR, 20),
    supportEmail: env.SUPPORT_EMAIL ?? 'podpora@dejinzerat.cz',
    supportPhone: env.SUPPORT_PHONE ?? '',
    operatorName: env.OPERATOR_NAME ?? '',
    operatorIco: env.OPERATOR_ICO ?? '',
    operatorAddress: env.OPERATOR_ADDRESS ?? '',
  };
}

/** Sloučí uložené hodnoty s výchozími; neplatné nebo neznámé klíče ignoruje. */
export function mergeSettings(defaults: Settings, rows: { key: string; value: unknown }[]): Settings {
  const out: Record<string, unknown> = { ...defaults };
  for (const r of rows) {
    const field = SettingsSchema.shape[r.key as keyof Settings];
    if (field && field.safeParse(r.value).success) out[r.key] = r.value;
  }
  return out as Settings;
}

const CACHE_KEY = 'settings:v1';

/**
 * Systémová nastavení z tabulky Setting (s cache 30 s v Redisu, bez Redisu v paměti instance).
 * Bez záznamu v DB platí hodnoty z prostředí (PREMODERATION, LISTING_DAYS, …).
 */
@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async all(): Promise<Settings> {
    const cached = await this.redis.get(CACHE_KEY).catch(() => null);
    if (cached) { try { return JSON.parse(cached) as Settings; } catch { /* poškozená cache */ } }
    const rows = await this.prisma.setting.findMany();
    const s = mergeSettings(envDefaults(), rows);
    await this.redis.set(CACHE_KEY, JSON.stringify(s), 30).catch(() => undefined);
    return s;
  }

  async get<K extends keyof Settings>(key: K): Promise<Settings[K]> { return (await this.all())[key]; }

  async publicSettings() {
    const s = await this.all();
    return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, s[k]]));
  }

  /** Uloží změněné klíče; vrátí původní a nové hodnoty pro auditní log. */
  async update(patch: Partial<Settings>) {
    const before = await this.all();
    const changed = (Object.keys(patch) as (keyof Settings)[]).filter((k) => patch[k] !== undefined && patch[k] !== before[k]);
    await this.prisma.$transaction(changed.map((key) => this.prisma.setting.upsert({ where: { key }, create: { key, value: patch[key] as Prisma.InputJsonValue }, update: { value: patch[key] as Prisma.InputJsonValue } })));
    await this.redis.del(CACHE_KEY).catch(() => undefined);
    return { changed: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: patch[k] }])), settings: await this.all() };
  }
}
