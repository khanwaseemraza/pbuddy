// Firebase for NATIVE (iOS/Android) via @react-native-firebase. Metro resolves
// this file in place of firebase.ts on device. Same interface as the web module.
// Requires a dev build (not Expo Go): `npx expo run:android` / `run:ios`.
import { Platform } from 'react-native';
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';

export interface AppUser {
  phoneNumber: string | null;
}
export interface OtpConfirmation {
  confirm(code: string): Promise<unknown>;
}

// Native phone auth. On a real device the OS attests the app (APNs on iOS, Play
// Integrity on Android). Android EMULATORS can't produce a valid Play Integrity
// verdict for a debug build, so in dev we force the reCAPTCHA web flow — that
// path works on the emulator and still sends a real SMS for testing.
export async function sendOtp(phone: string): Promise<OtpConfirmation> {
  const auth = authModule();
  if (__DEV__ && Platform.OS === 'android') {
    try {
      auth.settings.forceRecaptchaFlowForTesting = true;
    } catch {
      /* setting unavailable on this SDK version — ignore */
    }
  }
  const confirmation = await auth.signInWithPhoneNumber(phone);
  return { confirm: (code: string) => confirmation.confirm(code) };
}

export function subscribeAuth(cb: (u: AppUser | null) => void): () => void {
  return authModule().onAuthStateChanged((u) => cb(u ? { phoneNumber: u.phoneNumber } : null));
}

export function getIdToken(): Promise<string | null> {
  const u = authModule().currentUser;
  return u ? u.getIdToken() : Promise.resolve(null);
}

export function signOutUser(): Promise<void> {
  return authModule().signOut();
}

export function subscribeBookingStatus(id: string, onChange: () => void): () => void {
  try {
    return firestoreModule()
      .collection('booking_status')
      .doc(id)
      .onSnapshot(() => onChange(), () => {});
  } catch {
    return () => {};
  }
}
