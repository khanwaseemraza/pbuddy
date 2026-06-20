// Traveller's trips list.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, routeLabel } from '../src/lib/api';
import {
  EmptyState, FA, Glass, PageScreen, PrimaryButton, Skeleton, StatusChip,
} from '../src/components/flowkit';
import { C } from '../src/components/glass';

interface TripRow {
  id: string;
  corridor: string;
  direction: string;
  transport_mode: string;
  depart_at: string;
  status: string;
  journey_cost_pennies: number;
  remaining_pennies: number;
}

export default function Trips() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[] | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<{ trips: TripRow[] }>('/trips', token);
      setTrips(data.trips);
    } catch { setTrips([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <PageScreen
      onBack={() => router.back()}
      title="My trips"
      action={<PrimaryButton label="Post" icon="plus" onPress={() => router.push('/trip/new')} style={{ paddingVertical: 10, paddingHorizontal: 16 }} />}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {!trips ? (
        <><Skeleton /><Skeleton /></>
      ) : trips.length === 0 ? (
        <EmptyState icon="route" title="No trips yet" subtitle="Share a journey you're already taking and bring parcels along the way." />
      ) : (
        trips.map((item) => (
          <Pressable key={item.id} onPress={() => router.push(`/trip/${item.id}`)}>
            <Glass style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 }}>{routeLabel(item.corridor)}</Text>
                <StatusChip label={item.transport_mode} tone="accent" />
              </View>
              <Text style={{ color: C.muted, marginTop: 6 }}>
                {item.direction} · {new Date(item.depart_at).toLocaleDateString()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <FA name="gauge" size={12} color={C.muted2} />
                <Text style={{ color: C.muted }}>{gbp(item.remaining_pennies)} of {gbp(item.journey_cost_pennies)} cap left</Text>
              </View>
            </Glass>
          </Pressable>
        ))
      )}
    </PageScreen>
  );
}
