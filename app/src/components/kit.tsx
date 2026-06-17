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

// Map a booking/parcel/trip status to a pill tone.
export function statusTone(status: string): Tone {
  if (['delivered', 'released', 'matched', 'completed', 'verified'].includes(status)) return 'success';
  if (['disputed', 'refunded', 'cancelled', 'rejected'].includes(status)) return 'danger';
  if (['funded', 'picked_up', 'claimed', 'in_transit', 'pending'].includes(status)) return 'accent';
  return 'neutral';
}

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

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      {/* Restrained monochrome accent — no emoji. */}
      <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.border, marginBottom: 16 }} />
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ color: theme.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

// A numbered step badge (1, 2, 3…) — premium alternative to emoji bullets.
export function StepNumber({ n }: { n: number }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.accentText, fontWeight: '800' }}>{n}</Text>
    </View>
  );
}

export function Skeleton({ height = 64, style }: { height?: number; style?: ViewStyle }) {
  return <View style={[{ height, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 12 }, style]} />;
}

// Live delivery timeline (DPD/Uber-style). Highlights progress along the booking
// lifecycle from the current status.
const LIFECYCLE = ['claimed', 'funded', 'picked_up', 'delivered', 'released'];
const TIMELINE_STEPS = [
  { key: 'funded', label: 'Funded — ready for pickup' },
  { key: 'picked_up', label: 'Picked up — in transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'released', label: 'Completed — contribution released' },
];

export function StatusTimeline({ status }: { status: string }) {
  const cur = LIFECYCLE.indexOf(status);
  return (
    <View>
      {TIMELINE_STEPS.map((s, i) => {
        const idx = LIFECYCLE.indexOf(s.key);
        const done = cur >= idx;
        const active = cur === idx;
        const last = i === TIMELINE_STEPS.length - 1;
        return (
          <View key={s.key} style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: done ? theme.accent : 'transparent',
                  borderWidth: done ? 0 : 2,
                  borderColor: theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text> : null}
              </View>
              {!last ? <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: cur > idx ? theme.accent : theme.border }} /> : null}
            </View>
            <Text
              style={{
                color: done ? theme.text : theme.muted,
                fontWeight: active ? '800' : '600',
                paddingBottom: last ? 0 : 20,
              }}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
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
