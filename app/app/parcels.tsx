// Sender's parcels list.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, type ParcelSummary } from '../src/lib/api';
import { GlassCard } from '../src/components/GlassCard';
import { Button } from '../src/components/ui';
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
        <Text style={{ color: theme.danger }}>{error}</Text>
      ) : !parcels ? (
        <ActivityIndicator color={theme.accent} />
      ) : parcels.length === 0 ? (
        <Text style={{ color: theme.muted }}>No parcels yet — post your first one.</Text>
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Link href={`/parcel/${item.id}`} asChild>
              <Pressable>
                <GlassCard style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
                    <Text style={{ color: theme.accent, fontWeight: '700' }}>{item.status}</Text>
                  </View>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    {item.corridor} · {item.pickup_postcode} → {item.dropoff_postcode}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    up to {gbp(item.max_contribution_pennies)} · {Number(item.pending_bids)} bid
                    {Number(item.pending_bids) === 1 ? '' : 's'}
                  </Text>
                </GlassCard>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
