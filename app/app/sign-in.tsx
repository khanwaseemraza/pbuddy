// Phone-OTP sign-in. Enter a number -> receive a code -> verify. On web this
// uses Firebase's invisible reCAPTCHA (the container below maps to a DOM node).
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Link, useRouter, type Href } from 'expo-router';
import { sendOtp, type OtpConfirmation } from '../src/lib/firebase';
import { FlowScreen, Panel, PrimaryButton, TextField } from '../src/components/flowkit';
import { C } from '../src/components/glass';

export default function SignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState('+44');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<OtpConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendCode() {
    setBusy(true);
    setError(null);
    try {
      setConfirmation(await sendOtp(phone.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!confirmation) return;
    setBusy(true);
    setError(null);
    try {
      await confirmation.confirm(code.trim());
      router.replace('/home');
    } catch {
      setError('Invalid code — try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowScreen onBack={() => router.push('/')}>
      <Text style={{ color: C.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.9 }}>Welcome to pBuddy</Text>
      <Text style={{ color: C.body, fontSize: 16, marginTop: 8, marginBottom: 20 }}>
        Sign in with your phone to send a parcel or share a trip.
      </Text>

      <Panel>
        {!confirmation ? (
          <>
            <Text style={{ color: C.heading, fontWeight: '700', marginBottom: 8 }}>Phone number</Text>
            <TextField value={phone} onChangeText={setPhone} placeholder="+447700900000" keyboardType="phone-pad" style={{ marginBottom: 16 }} />
            <PrimaryButton label="Send code" onPress={onSendCode} busy={busy} />
          </>
        ) : (
          <>
            <Text style={{ color: C.heading, fontWeight: '700', marginBottom: 8 }}>Enter the 6-digit code</Text>
            <TextField value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" style={{ marginBottom: 16 }} />
            <PrimaryButton label="Verify" onPress={onVerify} busy={busy} />
            <Pressable onPress={() => setConfirmation(null)}>
              <Text style={{ color: C.muted, marginTop: 16, textAlign: 'center', fontWeight: '600' }}>Use a different number</Text>
            </Pressable>
          </>
        )}
        {error ? <Text style={{ color: C.coralStatus, marginTop: 16 }}>{error}</Text> : null}
      </Panel>

      <Text style={{ color: C.muted, fontSize: 13, marginTop: 18, lineHeight: 19 }}>
        By continuing you agree to pBuddy&apos;s{' '}
        <Link href={'/legal/terms' as Href} style={{ color: C.coral, fontWeight: '600' }}>Terms</Link>,{' '}
        <Link href={'/legal/privacy' as Href} style={{ color: C.coral, fontWeight: '600' }}>Privacy Policy</Link>, and{' '}
        <Link href={'/legal/prohibited_items' as Href} style={{ color: C.coral, fontWeight: '600' }}>Prohibited Items</Link> policy.
      </Text>

      {/* Invisible reCAPTCHA container (web only). */}
      {Platform.OS === 'web' ? <View nativeID="recaptcha-container" /> : null}
    </FlowScreen>
  );
}
