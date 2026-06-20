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

// Brand mark (matches the landing).
export function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>p</Text>
      </View>
      <Text style={{ color: C.heading, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>pBuddy</Text>
    </View>
  );
}

// A contained glass panel — the surface forms/steps live on so they read as a
// real, finished checkout rather than loose fields on an empty background.
export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[glass(), { borderRadius: 26, padding: 26 }, style]}>{children}</View>;
}

// Full-screen shell: warm bg, web ambient blobs, a branded header, and a single
// centred column so short content sits framed (not floating in a void).
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
          <Blob color={C.blob1} style={{ top: -180, right: -140 }} />
          <Blob color={C.blob2} style={{ top: '40%', left: -160 }} />
          <Blob color={C.blob3} style={{ bottom: -220, right: '20%' }} />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 }}>
        <View style={[{ width: '100%', maxWidth: 540 }, contentStyle]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Logo />
            <Pressable onPress={() => (onBack ? onBack() : router.back())} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <FA name="arrow-left-long" size={13} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 14.5, fontWeight: '600' }}>Back</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

function Blob({ color, style }: { color: string; style: ViewStyle }) {
  return <View style={[{ position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: color, opacity: 0.55 }, Platform.OS === 'web' ? ({ filter: 'blur(70px)' } as unknown as ViewStyle) : null, style]} />;
}

// Top-aligned page shell for hubs, lists and discovery (vs FlowScreen's centred
// single-panel layout for short flows). Branded header + optional title/action.
export function PageScreen({ children, title, subtitle, action, onBack }: { children: ReactNode; title?: string; subtitle?: string; action?: ReactNode; onBack?: () => void }) {
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
          <Blob color={C.blob1} style={{ top: -180, right: -140 }} />
          <Blob color={C.blob3} style={{ bottom: -220, left: -120 }} />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 56 }}>
        <View style={{ width: '100%', maxWidth: 640 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {onBack ? (
              <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <FA name="arrow-left-long" size={14} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 14.5, fontWeight: '600' }}>Back</Text>
              </Pressable>
            ) : <Logo />}
            {action}
          </View>
          {title ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: C.heading, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.9 }}>{title}</Text>
              {subtitle ? <Text style={{ color: C.body, fontSize: 16, lineHeight: 23, marginTop: 8 }}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: FAName; title: string; subtitle: string }) {
  return (
    <View style={[glass(), { borderRadius: 22, padding: 32, alignItems: 'center' }]}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
        <FA name={icon} size={24} color={C.coral} />
      </View>
      <Text style={{ color: C.heading, fontWeight: '800', fontSize: 18, marginTop: 14 }}>{title}</Text>
      <Text style={{ color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 }}>{subtitle}</Text>
    </View>
  );
}

export function Skeleton({ height = 96 }: { height?: number }) {
  return <View style={{ height, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 12 }} />;
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
