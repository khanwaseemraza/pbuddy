// Account & data (E16-S1, GDPR DSAR self-serve). Lets the signed-in user download
// everything we hold about them, and request erasure of their account. Erasure
// anonymises PII while the immutable compliance audit trail is retained under our
// legal-obligation basis. Built on the flow UI kit.
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, ApiError } from '../src/lib/api';
import { Glass, PageScreen, PrimaryButton } from '../src/components/flowkit';
import { C } from '../src/components/glass';

export default function Account() {
  const router = useRouter();
  const { getToken, signOut } = useAuth();
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy('export');
    setError(null);
    setMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.get<Record<string, unknown>>('/users/me/export', token);
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pbuddy-my-data.json';
        a.click();
        URL.revokeObjectURL(url);
        setMsg('Your data has been downloaded.');
      } else {
        setMsg(json.length > 1200 ? json.slice(0, 1200) + '\n…' : json);
      }
    } catch {
      setError('Could not export your data — please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function eraseAccount() {
    setBusy('erase');
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post('/users/me/erasure', token);
      await signOut();
      router.replace('/');
    } catch (e) {
      const err = e as ApiError;
      const b = err?.body as { error?: string; active?: number } | undefined;
      setError(
        b?.error === 'active_bookings_block_erasure'
          ? `You have ${b.active} booking(s) in progress. Finish or cancel them before deleting your account.`
          : 'Could not delete your account — please try again.',
      );
      setBusy(null);
    }
  }

  return (
    <PageScreen onBack={() => router.back()} title="Account & data" subtitle="Your privacy rights, under UK GDPR.">
      <Stack.Screen options={{ headerShown: false }} />

      <Glass style={{ marginBottom: 16 }}>
        <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16, marginBottom: 4 }}>Download my data</Text>
        <Text style={{ color: C.muted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
          Get a copy of everything we hold about you — your profile, parcels, trips, offers,
          bookings, payment records, and consent history.
        </Text>
        <PrimaryButton label={busy === 'export' ? 'Preparing…' : 'Download my data'} icon="download" onPress={exportData} busy={busy === 'export'} disabled={busy !== null} />
      </Glass>

      <Glass>
        <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16, marginBottom: 4 }}>Delete my account</Text>
        <Text style={{ color: C.muted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
          This permanently closes your account and removes your personal details. We keep a
          minimal, anonymised compliance record where the law requires it. You can't delete
          while a booking is in progress.
        </Text>
        {!confirmErase ? (
          <Pressable
            onPress={() => setConfirmErase(true)}
            disabled={busy !== null}
            style={{ borderWidth: 1, borderColor: '#c13515', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
          >
            <Text style={{ color: '#c13515', fontWeight: '800' }}>Delete my account</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={{ color: C.heading, fontWeight: '700' }}>Are you sure? This can't be undone.</Text>
            <Pressable
              onPress={eraseAccount}
              disabled={busy !== null}
              style={{ backgroundColor: '#c13515', borderRadius: 16, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{busy === 'erase' ? 'Deleting…' : 'Yes, delete permanently'}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmErase(false)} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </Glass>

      {msg ? <Text style={{ color: C.muted, marginTop: 16, fontSize: 12 }}>{msg}</Text> : null}
      {error ? <Text style={{ color: C.coralStatus, marginTop: 16 }}>{error}</Text> : null}
    </PageScreen>
  );
}
