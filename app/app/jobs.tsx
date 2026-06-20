// Traveller's jobs — bookings where you're carrying.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp, routeLabel } from '../src/lib/api';
import {
  EmptyState, FA, Glass, PageScreen, Skeleton, StatusChip,
} from '../src/components/flowkit';
import { C } from '../src/components/glass';
import { statusTone } from '../src/components/kit';

interface BookingRow {
  id: string;
  status: string;
  contribution_pennies: number;
  is_traveler: boolean;
  title: string;
  pickup_postcode: string;
  dropoff_postcode: string;
  corridor: string;
}

export default function Jobs() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<BookingRow[] | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<{ bookings: BookingRow[] }>('/bookings', token);
      setJobs(data.bookings.filter((b) => b.is_traveler));
    } catch { setJobs([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <PageScreen onBack={() => router.back()} title="My jobs" subtitle="Parcels you're carrying.">
      <Stack.Screen options={{ headerShown: false }} />
      {!jobs ? (
        <><Skeleton /><Skeleton /></>
      ) : jobs.length === 0 ? (
        <EmptyState icon="handshake" title="No jobs yet" subtitle="Offer to carry a parcel from one of your trips — accepted offers become jobs here." />
      ) : (
        jobs.map((item) => (
          <Pressable key={item.id} onPress={() => router.push(`/job/${item.id}`)}>
            <Glass style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 }}>{item.title}</Text>
                <StatusChip label={item.status} tone={(statusTone(item.status) as never)} />
              </View>
              <Text style={{ color: C.muted, marginTop: 6 }}>
                {routeLabel(item.corridor)} · {item.pickup_postcode} → {item.dropoff_postcode}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <FA name="hand-holding-dollar" size={12} color={C.muted2} />
                <Text style={{ color: C.muted }}>your share {gbp(item.contribution_pennies)}</Text>
              </View>
            </Glass>
          </Pressable>
        ))
      )}
    </PageScreen>
  );
}
