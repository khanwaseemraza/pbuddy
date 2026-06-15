// Authenticated home: proves the end-to-end auth path by calling the PBuddy API
// (/corridors) with the Firebase ID token, and shows the signed-in number.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { api, ApiError, type Corridor } from '../src/lib/api';
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
        <Pressable onPress={signOut}>
          <Text style={{ color: theme.muted }}>Sign out</Text>
        </Pressable>
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
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.display_name}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>{children}</View>;
}
