// Native map fallback. MapLibre GL JS is web-only; native will use
// @maplibre/maplibre-react-native in a dev build (follow-up). For now show the
// confirmed coordinates so the flow works on device.
import { Text, View } from 'react-native';
import { theme } from '../theme';

export function MapPin({ lat, lng }: { lat: number; lng: number }) {
  return (
    <View
      style={{
        height: 240,
        borderRadius: 12,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.accent, fontWeight: '700' }}>📍 Location confirmed</Text>
      <Text style={{ color: theme.muted, marginTop: 4 }}>
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </Text>
    </View>
  );
}
