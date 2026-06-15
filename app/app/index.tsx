import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { theme } from '../src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return <Redirect href={user ? '/home' : '/sign-in'} />;
}
