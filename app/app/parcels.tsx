// Sender's parcels list.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, type ParcelSummary } from '../src/lib/api';
import { Button } from '../src/components/ui';
import { Card, EmptyState, Skeleton, StatusPill, statusTone } from '../src/components/kit';
import { theme } from '../src/theme';

export default function Parcels() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [parcels, setParcels] = useState<ParcelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.get<{ parcels: ParcelSummary[] }>('/parcels', token);
      setParcels(data.parcels);
    } catch {
      setError('Could not load your parcels.');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>My parcels</Text>
      <View style={{ marginBottom: 20 }}>
        <Button label="+ Send a parcel" onPress={() => router.push('/parcel/new')} />
      </View>

      {error ? (
        <EmptyState title="Couldn’t load your parcels" subtitle="Check your connection and try again." />
      ) : !parcels ? (
        <>
          <Skeleton height={96} />
          <Skeleton height={96} />
        </>
      ) : parcels.length === 0 ? (
        <EmptyState title="No parcels yet" subtitle="Post your first parcel and travellers on your route can bid to carry it." />
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Link href={`/parcel/${item.id}`} asChild>
              <Pressable>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 }}>{item.title}</Text>
                    <StatusPill label={item.status} tone={statusTone(item.status)} />
                  </View>
                  <Text style={{ color: theme.muted, marginTop: 6 }}>
                    {item.corridor} · {item.pickup_postcode} → {item.dropoff_postcode}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    up to {gbp(item.max_contribution_pennies)} · {Number(item.pending_bids)} bid
                    {Number(item.pending_bids) === 1 ? '' : 's'}
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
