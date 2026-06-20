// Authenticated home / hub. Two big actions (send a parcel, share a trip), quick
// links into your activity, and the live routes. Built on the flow UI kit.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, ApiError, routeLabel, type Corridor } from '../src/lib/api';
import { registerForPush } from '../src/lib/push';
import { FA, FlowScreen, Glass, PageScreen, StatusChip, type FAName } from '../src/components/flowkit';
import { C } from '../src/components/glass';

export default function Home() {
  const { user, loading, getToken, signOut } = useAuth();
  const router = useRouter();
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await api.post('/users/me', token, { phone: user.phoneNumber, accept_legal: true });
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

  if (loading) {
    return <FlowScreen><View /></FlowScreen>;
  }
  if (!user) return <Redirect href="/sign-in" />;

  const headerActions = (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <Pressable onPress={() => router.push('/account')}><Text style={{ color: C.muted, fontWeight: '600', fontSize: 14 }}>Account</Text></Pressable>
      <Pressable onPress={() => router.push('/trust' as never)}><Text style={{ color: C.muted, fontWeight: '600', fontSize: 14 }}>Safety</Text></Pressable>
      <Pressable onPress={signOut}><Text style={{ color: C.muted, fontWeight: '600', fontSize: 14 }}>Sign out</Text></Pressable>
    </View>
  );

  return (
    <PageScreen action={headerActions} title={`Hi${user.phoneNumber ? ', ' + user.phoneNumber : ''}`} subtitle="What would you like to do?">
      {/* Two primary actions */}
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        <ActionTile icon="box" title="Send a parcel" body="Match with a verified Buddy going your way." onPress={() => router.push('/parcel/new')} filled />
        <ActionTile icon="route" title="Share your trip" body="Travelling anyway? Bring parcels along." onPress={() => router.push('/trip/new')} />
      </View>

      {/* Activity quick links */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <QuickLink icon="inbox" label="My parcels" onPress={() => router.push('/parcels')} />
        <QuickLink icon="route" label="My trips" onPress={() => router.push('/trips')} />
        <QuickLink icon="handshake" label="My jobs" onPress={() => router.push('/jobs')} />
      </View>

      {/* Live routes */}
      <Text style={{ color: C.heading, fontSize: 18, fontWeight: '800', marginTop: 32, marginBottom: 12 }}>Live routes</Text>
      {error ? (
        <Glass><Text style={{ color: C.coralStatus }}>{error}</Text></Glass>
      ) : !corridors ? (
        <Glass style={{ height: 64 }}><Text style={{ color: C.muted }}>Loading…</Text></Glass>
      ) : (
        corridors.map((c) => (
          <Glass key={c.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FA name="train" size={16} color={C.coral} />
              <Text style={{ color: C.heading, fontSize: 16, fontWeight: '700' }}>{routeLabel(c.display_name)}</Text>
            </View>
            <StatusChip label="Live" tone="success" />
          </Glass>
        ))
      )}
    </PageScreen>
  );
}

function ActionTile({ icon, title, body, onPress, filled }: { icon: FAName; title: string; body: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[{ flexGrow: 1, flexBasis: 220, borderRadius: 22, padding: 24 }, filled ? { backgroundColor: C.coral, shadowColor: C.coral, shadowOpacity: 0.3, shadowRadius: 40, shadowOffset: { width: 0, height: 18 } } : { backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder }]}>
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: filled ? 'rgba(255,255,255,0.22)' : C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
        <FA name={icon} size={20} color={filled ? '#fff' : C.coral} />
      </View>
      <Text style={{ color: filled ? '#fff' : C.heading, fontSize: 20, fontWeight: '800', marginTop: 16 }}>{title}</Text>
      <Text style={{ color: filled ? 'rgba(255,255,255,0.9)' : C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{body}</Text>
    </Pressable>
  );
}

function QuickLink({ icon, label, onPress }: { icon: FAName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[{ flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 8, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder }]}>
      <FA name={icon} size={18} color={C.coral} />
      <Text style={{ color: C.heading, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
