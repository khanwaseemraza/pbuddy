// Authenticated home: proves the end-to-end auth path by calling the PBuddy API
// (/corridors) with the Firebase ID token, and shows the signed-in number.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, Redirect, type Href } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, ApiError, type Corridor } from '../src/lib/api';
import { registerForPush } from '../src/lib/push';
import { GlassCard } from '../src/components/GlassCard';
import { theme } from '../src/theme';

export default function Home() {
  const { user, loading, getToken, signOut } = useAuth();
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        // Provision the user row on first load, then load data. Send the phone
        // from the Firebase user as a fallback (some ID tokens omit phone_number).
        // accept_legal records consent to the current legal bundle on first sign-up.
        await api.post('/users/me', token, { phone: user.phoneNumber, accept_legal: true });
        // Register this device for push (native only; web is a no-op). Best-effort.
        void registerForPush(getToken);
        const data = await api.get<{ corridors: Corridor[] }>('/corridors', token);
        setCorridors(data.corridors);
      } catch (e) {
        setError(
          e instanceof ApiError && e.status === 403
            ? 'Your account needs verification before browsing routes.'
            : 'Could not load routes — is the API running?',
        );
      }
    })();
  }, [user]);

  if (loading) return <Centered><ActivityIndicator color={theme.accent} /></Centered>;
  if (!user) return <Redirect href="/sign-in" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: theme.accent, fontSize: 26, fontWeight: '800' }}>PBuddy</Text>
          <Text style={{ color: theme.muted, marginTop: 2 }}>{user.phoneNumber}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Link href={'/legal' as Href} style={{ color: theme.muted }}>Legal</Link>
          <Pressable onPress={signOut}>
            <Text style={{ color: theme.muted }}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
        <HubButton href="/parcels" label="Send a parcel" filled />
        <HubButton href="/trips" label="Carry & earn" />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <HubButton href="/jobs" label="My jobs" />
        <HubButton href="/parcels" label="My parcels" />
      </View>

      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 32, marginBottom: 12 }}>
        Available corridors
      </Text>

      {error ? (
        <Text style={{ color: theme.danger }}>{error}</Text>
      ) : !corridors ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <FlatList
          data={corridors}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <GlassCard style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.display_name}</Text>
            </GlassCard>
          )}
        />
      )}
    </View>
  );
}

function HubButton({ href, label, filled }: { href: Href; label: string; filled?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: filled ? theme.accent : theme.cardSolid,
          borderWidth: filled ? 0 : 1,
          borderColor: theme.border,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: filled ? theme.accentText : theme.text, fontWeight: '800' }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>{children}</View>;
}
