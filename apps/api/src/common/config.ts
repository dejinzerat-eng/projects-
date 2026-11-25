export const config = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  publicApiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:4000',
  redisUrl: process.env.REDIS_URL,
  meiliUrl: process.env.MEILI_URL ?? 'http://127.0.0.1:7700',
  meiliKey: process.env.MEILI_KEY ?? '',
  cookieSecure: process.env.COOKIE_SECURE === '1',
  /** Inzeráty čekají na schválení moderátorem (jinak se zveřejní hned a kontroluje je automat). */
  premoderation: process.env.PREMODERATION === '1',
  listingDays: Number(process.env.LISTING_DAYS ?? 30),
  google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  turnstileSecret: process.env.TURNSTILE_SECRET,
  resendKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM ?? 'Dejinzerat.cz <noreply@dejinzerat.cz>',
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    publicUrl: process.env.S3_PUBLIC_URL || '',
  },
};
