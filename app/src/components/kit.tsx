// Design-system kit v2 (PBD/E20-S1): the reusable molecules the polished flows
// are built from — progress bar, screen title, status pills, cards, summary rows,
// empty/skeleton states, and a step navigation bar. Airbnb palette + glass.
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import { theme } from '../theme';

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? theme.accent : theme.border }}
        />
      ))}
    </View>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: theme.muted, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'rgba(0,0,0,0.06)', fg: theme.muted },
  success: { bg: 'rgba(30,127,78,0.12)', fg: '#1E7F4E' },
  warn: { bg: 'rgba(154,107,0,0.14)', fg: '#9A6B00' },
  danger: { bg: 'rgba(193,53,21,0.12)', fg: theme.danger },
  accent: { bg: 'rgba(255,90,95,0.12)', fg: theme.accent },
};

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.bg }}>
      <Text style={{ color: c.fg, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const inner = (
    <View
      style={[
        {
          backgroundColor: theme.cardSolid,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: theme.muted, flexShrink: 1, paddingRight: 12 }}>{label}</Text>
      <Text style={{ color: theme.text, fontWeight: strong ? '800' : '600', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</Text>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ color: theme.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function Skeleton({ height = 64, style }: { height?: number; style?: ViewStyle }) {
  return <View style={[{ height, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 12 }, style]} />;
}

export function StepNav({
  onBack,
  onNext,
  nextLabel,
  busy,
  disabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{ paddingVertical: 16, paddingHorizontal: 22, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={disabled || busy ? undefined : onNext}
        style={{
          flex: 1,
          backgroundColor: disabled ? 'rgba(255,90,95,0.45)' : theme.accent,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Text style={{ color: theme.accentText, fontWeight: '800', fontSize: 16 }}>{nextLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}
