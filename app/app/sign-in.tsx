// Phone-OTP sign-in. Enter a number -> receive a code -> verify. On web this
// uses Firebase's invisible reCAPTCHA (the container below maps to a DOM node).
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ConfirmationResult } from 'firebase/auth';
import { sendOtp } from '../src/lib/firebase';
import { theme } from '../src/theme';

export default function SignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState('+44');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
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
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: theme.accent, fontSize: 34, fontWeight: '800' }}>PBuddy</Text>
      <Text style={{ color: theme.muted, fontSize: 16, marginTop: 4, marginBottom: 32 }}>
        Cost-sharing parcel delivery. Sign in with your phone.
      </Text>

      {!confirmation ? (
        <>
          <Label>Phone number</Label>
          <Input value={phone} onChangeText={setPhone} placeholder="+447700900000" keyboardType="phone-pad" />
          <Button label="Send code" onPress={onSendCode} busy={busy} />
        </>
      ) : (
        <>
          <Label>Enter the 6-digit code</Label>
          <Input value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" />
          <Button label="Verify" onPress={onVerify} busy={busy} />
          <Pressable onPress={() => setConfirmation(null)}>
            <Text style={{ color: theme.muted, marginTop: 16, textAlign: 'center' }}>Use a different number</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={{ color: theme.danger, marginTop: 16 }}>{error}</Text> : null}

      {/* Invisible reCAPTCHA container (web only). */}
      {Platform.OS === 'web' ? <View nativeID="recaptcha-container" /> : null}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: theme.text, marginBottom: 8, fontWeight: '600' }}>{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.muted}
      style={{
        backgroundColor: theme.card,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 18,
        marginBottom: 20,
      }}
    />
  );
}

function Button({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{ backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
    >
      {busy ? <ActivityIndicator color={theme.accentText} /> : <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 16 }}>{label}</Text>}
    </Pressable>
  );
}
