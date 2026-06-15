// Traveller's jobs — bookings where you're carrying.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, gbp } from '../src/lib/api';
import { GlassCard } from '../src/components/GlassCard';
import { theme } from '../src/theme';

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
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>My jobs</Text>
      {!jobs ? (
        <ActivityIndicator color={theme.accent} />
      ) : jobs.length === 0 ? (
        <Text style={{ color: theme.muted }}>No jobs yet — bid on a parcel from one of your trips.</Text>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <Link href={`/job/${item.id}`} asChild>
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
                    your contribution {gbp(item.contribution_pennies)}
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
