// Firebase init + phone-OTP helpers. Web uses the Firebase JS SDK with an
// invisible reCAPTCHA. Native (iOS/Android) phone auth needs a dev build with
// @react-native-firebase — wired as a follow-up; the web path works in Expo today.
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { firebaseConfig } from '../../firebaseConfig';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

let recaptcha: RecaptchaVerifier | null = null;

/** Send a one-time code to a phone number (E.164, e.g. +447700900000). */
export async function sendOtp(phone: string): Promise<ConfirmationResult> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Native phone auth needs a dev build with @react-native-firebase. Use the web app for now.',
    );
  }
  // The container is rendered by the sign-in screen (nativeID -> DOM id on web).
  if (!recaptcha) {
    recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }
  return signInWithPhoneNumber(auth, phone, recaptcha);
}
