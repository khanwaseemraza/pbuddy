// Small shared UI atoms (Airbnb + glass styling).
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={theme.muted}
      {...props}
      style={[
        {
          backgroundColor: theme.cardSolid,
          color: theme.text,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
        },
        props.style as object,
      ]}
    />
  );
}

export function Button({
  label,
  onPress,
  busy,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        backgroundColor: primary ? theme.accent : 'transparent',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color={primary ? theme.accentText : theme.accent} />
      ) : (
        <Text style={{ color: primary ? theme.accentText : theme.accent, fontWeight: '800', fontSize: 16 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? theme.accent : theme.border,
        backgroundColor: active ? theme.accent : theme.cardSolid,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? theme.accentText : theme.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
