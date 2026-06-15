// Firebase Web SDK config for the PBuddy client (Expo iOS/Android/web).
// These values are public by design (client-side Firebase config) — safe to
// commit. Security is enforced by Firebase Auth + Firestore rules + the API,
// not by hiding these keys.
//
// Project: pbuddy-mvp (PBuddy MVP). Phone sign-in is enabled.
export const firebaseConfig = {
  apiKey: 'AIzaSyBOHKe5ICd0M3_GnhupcYRA540TwJtR3aY',
  authDomain: 'pbuddy-mvp.firebaseapp.com',
  projectId: 'pbuddy-mvp',
  storageBucket: 'pbuddy-mvp.firebasestorage.app',
  messagingSenderId: '413412903611',
  appId: '1:413412903611:web:da44b74ecb41aa647b379e',
} as const;
