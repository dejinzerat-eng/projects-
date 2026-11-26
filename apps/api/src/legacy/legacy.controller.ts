import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { ZodPipe } from '../common/zod';
import { LegacyImportService } from './legacy-import.service';
import { LEGACY_LISTING_ID } from './legacy-map';

const Uuid = z.string().regex(LEGACY_LISTING_ID, 'Neplatné ID inzerátu.');
const RunDto = z.object({ ids: z.array(Uuid).min(1).max(500) });
const ArchiveDto = z.object({ ids: z.array(Uuid).min(1).max(5000) });
const InviteDto = z.object({ confirm: z.literal(true, { error: 'Potvrďte rozeslání.' }) });

/** Import ze starého webu www.dejinzerat.cz – jen hlavní administrátor (settings.manage). */
@Controller('admin/legacy')
export class LegacyAdminController {
  constructor(private legacy: LegacyImportService) {}

  @Can('settings.manage')
  @Post('scan')
  scan() { return this.legacy.scan(); }

  @Can('settings.manage')
  @Post('run')
  run(@CurrentUser() u: AuthUser, @Body(new ZodPipe(RunDto)) dto: z.infer<typeof RunDto>) { return this.legacy.run(dto.ids, u.id); }

  @Can('settings.manage')
  @Post('archive-missing')
  archive(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ArchiveDto)) dto: z.infer<typeof ArchiveDto>) { return this.legacy.archiveMissing(dto.ids, u.id); }

  @Can('settings.manage')
  @Get('invites')
  invites() { return this.legacy.inviteStatus(); }

  @Can('settings.manage')
  @Post('invites')
  sendInvites(@CurrentUser() u: AuthUser, @Body(new ZodPipe(InviteDto)) _dto: z.infer<typeof InviteDto>) { return this.legacy.sendInvites(u.id); }
}

/** Veřejné: stará adresa inzerátu /produkt?id=… → nový inzerát. */
@Controller('legacy')
export class LegacyPublicController {
  constructor(private legacy: LegacyImportService) {}

  @Get('listing/:id')
  async listing(@Param('id') id: string) {
    if (!Uuid.safeParse(id).success) throw new NotFoundException();
    const l = await this.legacy.resolve(id.toLowerCase());
    if (!l) throw new NotFoundException();
    return l;
  }
}
