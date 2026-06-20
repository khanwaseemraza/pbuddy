// Flow UI kit — the new design language (Airbnb palette + Apple glass, solid
// coral, FontAwesome, no emoji/gradients) for the authenticated booking flow, so
// the send/pay/hand-off screens match the public landing. Pure presentation;
// screens keep their own logic. Shares tokens with the landing via glass.ts.
import { type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { C, glass } from './glass';

export type FAName = React.ComponentProps<typeof FontAwesome6>['name'];

export function useIconFont(): boolean {
  const [loaded, err] = useFonts(FontAwesome6.font);
  return loaded || !!err;
}

export function FA({ name, size = 16, color = C.coral }: { name: FAName; size?: number; color?: string }) {
  return <FontAwesome6 name={name} size={size} color={color} solid />;
}

// Full-screen shell: warm bg, web ambient blobs, optional back header, scroll.
export function FlowScreen({ children, onBack, contentStyle }: { children: ReactNode; onBack?: () => void; contentStyle?: ViewStyle }) {
  const router = useRouter();
  const ready = useIconFont();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.coral} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' } as ViewStyle}>
          <Blob color={C.blob1} style={{ top: -180, right: -120 }} />
          <Blob color={C.blob3} style={{ bottom: -220, left: -120 }} />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ padding: 24, paddingTop: 56, paddingBottom: 56, maxWidth: 640, width: '100%', alignSelf: 'center' }, contentStyle]}>
        <Pressable onPress={() => (onBack ? onBack() : router.back())} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <FA name="arrow-left-long" size={14} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 14.5, fontWeight: '600' }}>Back</Text>
        </Pressable>
        {children}
      </ScrollView>
    </View>
  );
}

function Blob({ color, style }: { color: string; style: ViewStyle }) {
  return <View style={[{ position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: color, opacity: 0.6 }, Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as unknown as ViewStyle) : null, style]} />;
}

export function ScreenHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={{ color: C.heading, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.9 }}>{title}</Text>
      {subtitle ? <Text style={{ color: C.body, fontSize: 16, lineHeight: 23, marginTop: 8 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function Glass({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[glass(), { borderRadius: 20, padding: 18 }, style]}>{children}</View>;
}

export function PrimaryButton({ label, icon, onPress, busy, disabled, style }: { label: string; icon?: FAName; onPress: () => void; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const off = busy || disabled;
  return (
    <Pressable onPress={onPress} disabled={off} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.coral, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, opacity: off ? 0.55 : 1 }, style]}>
      {busy ? <ActivityIndicator color="#fff" /> : (
        <>
          {icon ? <FA name={icon} size={15} color="#fff" /> : null}
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, icon, onPress, busy, disabled }: { label: string; icon?: FAName; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const off = busy || disabled;
  return (
    <Pressable onPress={onPress} disabled={off} style={[glass(), { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, opacity: off ? 0.55 : 1 }]}>
      {icon ? <FA name={icon} size={15} color={C.heading} /> : null}
      <Text style={{ color: C.heading, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[active ? { backgroundColor: C.coral, borderColor: C.coral } : glass(), { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginRight: 8, marginBottom: 8 }]}
    >
      <Text style={{ color: active ? '#fff' : C.heading, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: C.heading, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.muted2}
      {...props}
      style={[{ backgroundColor: '#fff', color: C.heading, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 }, props.style as object]}
    />
  );
}

export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? C.coral : C.line, backgroundColor: checked ? C.coral : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {checked ? <FA name="check" size={12} color="#fff" /> : null}
      </View>
      <Text style={{ color: C.heading, fontSize: 15, lineHeight: 21, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: strong ? C.heading : C.muted, fontSize: strong ? 16 : 14.5, fontWeight: strong ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: C.heading, fontSize: strong ? 16 : 14.5, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />;
}

type Tone = 'accent' | 'success' | 'danger' | 'neutral';
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const map: Record<Tone, { bg: string; fg: string }> = {
    accent: { bg: 'rgba(255,90,95,0.12)', fg: C.coralStatus },
    success: { bg: C.greenBg, fg: C.green },
    danger: { bg: 'rgba(193,53,21,0.12)', fg: '#c13515' },
    neutral: { bg: 'rgba(0,0,0,0.05)', fg: C.muted },
  };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ height: 5, flex: 1, borderRadius: 999, backgroundColor: i <= step ? C.coral : 'rgba(0,0,0,0.08)' }} />
      ))}
    </View>
  );
}

export function StepNav({ onBack, onNext, nextLabel, busy, disabled }: { onBack?: () => void; onNext: () => void; nextLabel: string; busy?: boolean; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
      {onBack ? (
        <Pressable onPress={onBack} style={[glass(), { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: C.heading, fontWeight: '700', fontSize: 16 }}>Back</Text>
        </Pressable>
      ) : null}
      <PrimaryButton label={nextLabel} onPress={onNext} busy={busy} disabled={disabled} style={{ flex: 1 }} />
    </View>
  );
}
