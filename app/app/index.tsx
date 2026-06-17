// Public landing — browse-first, no login required (BlaBlaCar/Uber pattern).
// Signed-in users go straight to the hub; visitors see the value prop, how
// cost-sharing works, live corridors, and a contribution estimator. Auth is only
// required to actually post/bid/pay.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Redirect, useRouter, type Href } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, type Corridor } from '../src/lib/api';
import { Chip } from '../src/components/ui';
import { Card, ScreenTitle, StatusPill } from '../src/components/kit';
import { theme } from '../src/theme';

// Representative intercity distances (km) for the seeded corridors — drives the
// public estimate before exact postcodes are entered.
const CORRIDOR_KM: Record<string, number> = {
  'London <-> Manchester': 320,
  'London <-> Birmingham': 190,
  'London <-> Leeds': 310,
};

const STEPS: { emoji: string; title: string; body: string }[] = [
  { emoji: '📦', title: 'Post your parcel', body: 'Pick a route, add pickup & drop-off, set a contribution.' },
  { emoji: '🧭', title: 'A traveller carries it', body: 'Someone already making the trip bids to take it along.' },
  { emoji: '🤝', title: 'Hand-off & done', body: 'QR/OTP hand-off; the contribution is released on delivery.' },
];

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);

  // Public fetch — no token needed.
  useEffect(() => {
    api
      .getPublic<{ corridors: Corridor[] }>('/corridors')
      .then((d) => {
        setCorridors(d.corridors);
        setRouteId(d.corridors[0]?.id ?? null);
      })
      .catch(() => setCorridors([]));
  }, []);

  // Recompute the public estimate whenever size/route changes.
  useEffect(() => {
    const c = corridors.find((x) => x.id === routeId);
    if (!c) return;
    const km = CORRIDOR_KM[c.display_name] ?? 250;
    api
      .getPublic<{ suggested_contribution_pennies: number }>(`/price-suggestion?size_band=${size}&distance_km=${km}`)
      .then((r) => setEstimate(r.suggested_contribution_pennies))
      .catch(() => setEstimate(null));
  }, [size, routeId, corridors]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (user) return <Redirect href="/home" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 56 }}>
      {/* Hero */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.accent, fontSize: 30, fontWeight: '900' }}>PBuddy</Text>
        <Link href={'/sign-in' as Href} style={{ color: theme.muted, fontWeight: '600' }}>Sign in</Link>
      </View>
      <Text style={{ color: theme.text, fontSize: 34, fontWeight: '900', marginTop: 28, lineHeight: 40 }}>
        Send parcels with people already going your way.
      </Text>
      <Text style={{ color: theme.muted, fontSize: 16, marginTop: 12, lineHeight: 23 }}>
        Cost-sharing parcel delivery between UK cities. Cheaper for senders, covers travellers’ costs — never a courier fee.
      </Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Cta label="Send a parcel" onPress={() => router.push('/parcel/new')} filled />
        <Cta label="Carry & earn" onPress={() => router.push('/trip/new')} />
      </View>

      {/* Estimator */}
      <View style={{ marginTop: 36 }}>
        <ScreenTitle title="Estimate a contribution" subtitle="See a fair price before you sign up." />
        <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>Parcel size</Text>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Chip label="Small" active={size === 'S'} onPress={() => setSize('S')} />
          <Chip label="Medium" active={size === 'M'} onPress={() => setSize('M')} />
          <Chip label="Large" active={size === 'L'} onPress={() => setSize('L')} />
        </View>
        <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>Route</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {corridors.map((c) => (
            <Chip key={c.id} label={c.display_name} active={c.id === routeId} onPress={() => setRouteId(c.id)} />
          ))}
        </View>
        <Card style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ color: theme.muted }}>Suggested contribution</Text>
          <Text style={{ color: theme.accent, fontSize: 32, fontWeight: '900', marginTop: 4 }}>
            {estimate != null ? `≈ ${gbp(estimate)}` : '—'}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>capped to the traveller’s own journey cost</Text>
        </Card>
      </View>

      {/* How it works */}
      <View style={{ marginTop: 36 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>How it works</Text>
        {STEPS.map((s, i) => (
          <Card key={i} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 26, marginRight: 14 }}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '800' }}>{s.title}</Text>
                <Text style={{ color: theme.muted, marginTop: 2, lineHeight: 19 }}>{s.body}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {/* Live corridors */}
      <View style={{ marginTop: 28 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>Live routes</Text>
        {corridors.map((c) => (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{c.display_name}</Text>
              <StatusPill label="active" tone="success" />
            </View>
          </Card>
        ))}
      </View>

      <View style={{ marginTop: 28 }}>
        <Cta label="Get started" onPress={() => router.push('/parcel/new')} filled />
        <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 14 }}>
          By continuing you agree to our{' '}
          <Link href={'/legal/terms' as Href} style={{ color: theme.accent }}>Terms</Link> &{' '}
          <Link href={'/legal/privacy' as Href} style={{ color: theme.accent }}>Privacy Policy</Link>.
        </Text>
      </View>
    </ScrollView>
  );
}

function Cta({ label, onPress, filled }: { label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
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
      <Text style={{ color: filled ? theme.accentText : theme.text, fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
