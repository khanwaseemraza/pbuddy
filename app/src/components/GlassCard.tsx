// Glassmorphic surface (native fallback): translucent card + shadow. True blur
// comes later via expo-blur in a dev build; this keeps the look on device.
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          borderRadius: 16,
          padding: 16,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
