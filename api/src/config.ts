// Centralised runtime config. Read once at boot.
export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: process.env.DATABASE_URL ?? '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  // Dev/test escape hatch: when "1", the bearer token is trusted as a raw
  // firebase_uid and no real Firebase verification happens. Must be 0 in prod.
  authDevBypass: process.env.AUTH_DEV_BYPASS === '1',
  postcodesIoBase: process.env.POSTCODES_IO_BASE ?? 'https://api.postcodes.io',
  // Firestore status mirror is best-effort; disable it (e.g. in tests / when no
  // credentials) so the API never blocks on it. Postgres remains source of truth.
  disableFirestoreMirror: process.env.DISABLE_FIRESTORE_MIRROR === '1',
  // Admins allowed to pull compliance evidence exports (Firebase UID allowlist).
  adminUids: (process.env.ADMIN_FIREBASE_UIDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  // Price-suggestion bands (pence). A fair "contribution to costs" anchor for the
  // sender — always clamped below maxSuggestedContributionPennies.
  priceBase: { S: 200, M: 400, L: 700 } as Record<'S' | 'M' | 'L', number>,
  pricePerKmPennies: 8,
  maxSuggestedContributionPennies: 5000, // £50 — a typical single intercity journey
  // Marketplace economics (pence / basis points).
  platformFeeBps: 1200, // 12% platform fee charged to the sender
  escrowFeePennies: 150, // flat £1.50
  insurancePremiumPennies: 199, // £1.99 charged to sender
  insuranceCostPennies: 50, // ~50p paid to insurer
  // Stripe (TEST mode). Keys live in api/.env (gitignored) / Secret Manager.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  // Base URL the Connect onboarding flow returns to.
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:8080',
  // Web origins allowed to call the API (CORS). Override via CORS_ORIGINS (CSV).
  corsOrigins: (process.env.CORS_ORIGINS ??
    'https://pbuddy-mvp.web.app,https://pbuddy-mvp.firebaseapp.com,https://pbuddy.co.uk,https://www.pbuddy.co.uk,http://localhost:8081,http://localhost:19006')
    .split(',').map((s) => s.trim()).filter(Boolean),
} as const;
