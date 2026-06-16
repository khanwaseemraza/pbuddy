// Firebase for NATIVE (iOS/Android) via @react-native-firebase. Metro resolves
// this file in place of firebase.ts on device. Same interface as the web module.
// Requires a dev build (not Expo Go): `npx expo run:android` / `run:ios`.
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';

export interface AppUser {
  phoneNumber: string | null;
}
export interface OtpConfirmation {
  confirm(code: string): Promise<unknown>;
}

// Native phone auth needs no reCAPTCHA container; the OS attests the app.
export async function sendOtp(phone: string): Promise<OtpConfirmation> {
  const confirmation = await authModule().signInWithPhoneNumber(phone);
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
