// Firebase Admin wrapper for verifying phone-auth ID tokens.
//
// verifyIdToken only needs the PROJECT ID (it fetches Google's public certs and
// checks the token's audience/issuer) — no service account / ADC required. So we
// initialise with just projectId, which lets the API verify real tokens locally
// and on Cloud Run without credentials. (Other Admin operations would need
// credentials, but we don't use them here.)
import { config } from '../config.ts';

let _adminAuth: import('firebase-admin/auth').Auth | null = null;

async function getAuth() {
  if (_adminAuth) return _adminAuth;
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getAuth: _getAuth } = await import('firebase-admin/auth');
  if (getApps().length === 0) {
    initializeApp({ projectId: config.firebaseProjectId });
  }
  _adminAuth = _getAuth();
  return _adminAuth;
}

export interface VerifiedToken {
  uid: string;
  phoneNumber?: string;
}

/** Verify a Firebase ID token, returning the uid. Honors the dev bypass. */
export async function verifyIdToken(token: string): Promise<VerifiedToken> {
  if (config.authDevBypass) {
    // The bearer token IS the firebase_uid. Dev/test only.
    return { uid: token };
  }
  const auth = await getAuth();
  const decoded = await auth.verifyIdToken(token);
  return { uid: decoded.uid, phoneNumber: decoded.phone_number };
}
