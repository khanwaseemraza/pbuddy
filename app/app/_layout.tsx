import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/auth/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="home" />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
