// Sender's parcels list.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, routeLabel, type ParcelSummary } from '../src/lib/api';
import {
  EmptyState, FA, Glass, PageScreen, PrimaryButton, Skeleton, StatusChip,
} from '../src/components/flowkit';
import { C } from '../src/components/glass';
import { statusTone } from '../src/components/kit';

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
    <PageScreen
      onBack={() => router.back()}
      title="My parcels"
      action={<PrimaryButton label="Send" icon="plus" onPress={() => router.push('/parcel/new')} style={{ paddingVertical: 10, paddingHorizontal: 16 }} />}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {error ? (
        <EmptyState icon="triangle-exclamation" title="Couldn't load your parcels" subtitle="Check your connection and try again." />
      ) : !parcels ? (
        <><Skeleton /><Skeleton /></>
      ) : parcels.length === 0 ? (
        <EmptyState icon="box" title="No parcels yet" subtitle="Post your first parcel and Buddies on your route can offer to take it along." />
      ) : (
        parcels.map((item) => (
          <Pressable key={item.id} onPress={() => router.push(`/parcel/${item.id}`)}>
            <Glass style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 }}>{item.title}</Text>
                <StatusChip label={item.status} tone={chipTone(item.status)} />
              </View>
              <Text style={{ color: C.muted, marginTop: 6 }}>
                {routeLabel(item.corridor)} · {item.pickup_postcode} → {item.dropoff_postcode}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <FA name="hand-holding-dollar" size={12} color={C.muted2} />
                <Text style={{ color: C.muted }}>
                  up to {gbp(item.max_contribution_pennies)} · {Number(item.pending_bids)} offer{Number(item.pending_bids) === 1 ? '' : 's'}
                </Text>
              </View>
            </Glass>
          </Pressable>
        ))
      )}
    </PageScreen>
  );
}

function chipTone(status: string): 'accent' | 'success' | 'danger' | 'neutral' {
  const t = statusTone(status);
  return (['accent', 'success', 'danger', 'neutral'] as const).includes(t as never) ? (t as never) : 'neutral';
}
