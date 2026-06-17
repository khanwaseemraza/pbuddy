// Traveller's trips list.
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp } from '../src/lib/api';
import { Button } from '../src/components/ui';
import { Card, EmptyState, Skeleton, StatusPill } from '../src/components/kit';
import { theme } from '../src/theme';

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
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>My trips</Text>
      <View style={{ marginBottom: 20 }}>
        <Button label="+ Post a trip" onPress={() => router.push('/trip/new')} />
      </View>
      {!trips ? (
        <>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </>
      ) : trips.length === 0 ? (
        <EmptyState emoji="🧭" title="No trips yet" subtitle="Post a journey you’re already taking and carry parcels along the way." />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Link href={`/trip/${item.id}`} asChild>
              <Pressable>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 }}>{item.corridor}</Text>
                    <StatusPill label={item.transport_mode} tone="accent" />
                  </View>
                  <Text style={{ color: theme.muted, marginTop: 6 }}>
                    {item.direction} · {new Date(item.depart_at).toLocaleDateString()}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    {gbp(item.remaining_pennies)} of {gbp(item.journey_cost_pennies)} headroom left
                  </Text>
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
