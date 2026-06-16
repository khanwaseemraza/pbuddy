// Push registration — NATIVE. Requests notification permission, gets the FCM
// device token, and registers it with the API so booking-transition pushes can
// reach this device. Best-effort: failures never block the app.
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { api } from './api';

export async function registerForPush(getToken: () => Promise<string | null>): Promise<void> {
  try {
    const status = await messaging().requestPermission();
    const granted =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!granted) return;

    const fcmToken = await messaging().getToken();
    const idToken = await getToken();
    if (!fcmToken || !idToken) return;

    await api.post('/devices/register', idToken, {
      token: fcmToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch {
    // best-effort: a device without push just won't receive notifications
  }
}
