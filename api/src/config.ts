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
  // Marketplace economics (pence / basis points).
  platformFeeBps: 1200, // 12% platform fee charged to the sender
  escrowFeePennies: 150, // flat £1.50
  insurancePremiumPennies: 199, // £1.99 charged to sender
  insuranceCostPennies: 50, // ~50p paid to insurer
} as const;
