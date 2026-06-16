// Firebase for WEB (Metro picks firebase.native.ts on iOS/Android). Exposes a
// small platform-agnostic interface so AuthProvider / sign-in / useLiveBooking
// never touch platform-specific SDK objects.
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from '../../firebaseConfig';

export interface AppUser {
  phoneNumber: string | null;
}
export interface OtpConfirmation {
  confirm(code: string): Promise<unknown>;
}

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let recaptcha: RecaptchaVerifier | null = null;

/** Send a one-time code to a phone number (E.164, e.g. +447700900000). */
export async function sendOtp(phone: string): Promise<OtpConfirmation> {
  // The container is rendered by the sign-in screen (nativeID -> DOM id on web).
  if (!recaptcha) {
    recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }
  try {
    return await signInWithPhoneNumber(auth, phone, recaptcha);
  } catch (err) {
    // reCAPTCHA tokens are single-use — reset so a retry gets a fresh one.
    try {
      recaptcha.clear();
    } catch {
      /* ignore */
    }
    recaptcha = null;
    throw err;
  }
}

export function subscribeAuth(cb: (u: AppUser | null) => void): () => void {
  return onAuthStateChanged(auth, (u) => cb(u ? { phoneNumber: u.phoneNumber } : null));
}

export function getIdToken(): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null);
}

export function signOutUser(): Promise<void> {
  return fbSignOut(auth);
}

/** Subscribe to a booking's mirror doc; returns an unsubscribe. */
export function subscribeBookingStatus(id: string, onChange: () => void): () => void {
  try {
    return onSnapshot(doc(db, 'booking_status', id), () => onChange(), () => {});
  } catch {
    return () => {};
  }
}
