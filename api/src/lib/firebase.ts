// Firebase Admin wrapper for verifying phone-auth ID tokens. In Cloud Run this
// uses Application Default Credentials; locally it can use a service-account
// file via GOOGLE_APPLICATION_CREDENTIALS, or be bypassed for dev/tests.
import { config } from '../config.ts';

let _adminAuth: import('firebase-admin/auth').Auth | null = null;

async function getAuth() {
  if (_adminAuth) return _adminAuth;
  const { initializeApp, getApps, applicationDefault } = await import('firebase-admin/app');
  const { getAuth: _getAuth } = await import('firebase-admin/auth');
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: config.firebaseProjectId,
    });
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
