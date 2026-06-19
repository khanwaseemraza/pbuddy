// Public marketing landing — implements design/handoff "pBuddy Landing" (v2,
// brief-conformant). Cost-sharing marketplace: Sender <-> verified Buddy already
// travelling by public transport / bike / foot. HARD RULES (design/DESIGN-BRIEF.md
// + PBD-144/145): no emoji (FontAwesome only), no gradients (solid coral), Airbnb
// palette + Apple glassmorphism, framing-clean copy, greener public/bike/foot scope.
// Signed-in users skip straight to the hub; everyone else gets the marketing page.
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, View,
  useWindowDimensions, type LayoutChangeEvent, type ViewStyle,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthProvider';

type FAName = React.ComponentProps<typeof FontAwesome6>['name'];

// ---- Design tokens (from the handoff spec) ------------------------------
const C = {
  coral: '#FF5A5F',
  coralDark: '#c23b46',
  coralStatus: '#d12a4d',
  bg: '#fbf3ee',
  blob1: '#ffe1d6', blob2: '#ffd9dc', blob3: '#ffe9d2',
  glass: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.85)',
  heading: '#1d1d1f',
  body: '#5b5b5f',
  muted: '#6b6b70', muted2: '#8a8a8f', muted3: '#9a9a9f',
  green: '#1f9d57', greenBg: '#e8f7ee',
  amber: '#f5a623',
  tileTint: '#fff0ec',
  avatarBg: '#ffd9c2', avatarFg: '#c8603a',
  line: 'rgba(0,0,0,0.07)',
};

// Web-only glassmorphism (translucent + blur); native falls back to translucent.
const glass = (intensity: 'standard' | 'subtle' | 'vivid' = 'standard'): ViewStyle => {
  const bg = intensity === 'subtle' ? 'rgba(255,255,255,0.8)' : intensity === 'vivid' ? 'rgba(255,255,255,0.58)' : C.glass;
  const web = Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px) saturate(165%)' } as unknown as ViewStyle) : null;
  return {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: '#963c32',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    ...web,
  };
};

const MAXW = 1180;

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const onSectionLayout = (key: string) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const scrollTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.coral} />
      </View>
    );
  }
  if (user) return <Redirect href="/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Ambient warm blobs (web blur; skipped on native to avoid hard circles) */}
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' } as ViewStyle}>
          <Blob color={C.blob1} style={{ top: -160, left: -120 }} />
          <Blob color={C.blob2} style={{ top: 120, right: -160 }} />
          <Blob color={C.blob3} style={{ bottom: -200, left: '30%' }} />
        </View>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }}>
        <Nav narrow={narrow} onNav={scrollTo} onStart={() => router.push('/parcel/new')} />

        {/* ---- HERO ---- */}
        <Section pad={{ paddingTop: 96, paddingBottom: 40 }}>
          <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 48, alignItems: 'center' }}>
            <View style={{ flex: narrow ? undefined : 1.05, width: '100%' }}>
              <Eyebrow pill>A cost-sharing community, not a logistics company</Eyebrow>
              <Text style={{ color: C.heading, fontSize: narrow ? 40 : 60, lineHeight: narrow ? 44 : 62, fontWeight: '800', letterSpacing: -1.6, marginTop: 22 }}>
                Send it with someone already going your way.
              </Text>
              <Text style={{ color: C.body, fontSize: 19, lineHeight: 29, marginTop: 22, maxWidth: 520 }}>
                pBuddy connects a Sender with a verified Buddy already making the journey — by
                train, bus, bike or on foot. You simply <Text style={{ color: C.heading, fontWeight: '700' }}>share the journey cost</Text>,
                capped so it never exceeds what the trip actually costs.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
                <BtnSolid icon="box" label="Send a parcel" onPress={() => router.push('/parcel/new')} />
                <BtnGlass icon="route" label="Become a buddy" onPress={() => router.push('/trip/new')} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 28 }}>
                <TrustInline icon="circle-check" text="Right-to-Work verified buddies" />
                <TrustInline icon="lock" text="Contributions held in escrow" />
              </View>
            </View>

            <View style={{ flex: narrow ? undefined : 0.95, width: '100%', alignItems: 'center' }}>
              <HeroCard />
            </View>
          </View>
        </Section>

        {/* ---- TRUST STAT STRIP ---- */}
        <Section pad={{ paddingTop: 8, paddingBottom: 8 }}>
          <View style={[glass(), { borderRadius: 18, padding: 22, flexDirection: narrow ? 'column' : 'row', gap: 18 }]}>
            {STATS.map((s) => (
              <View key={s.label} style={{ flex: narrow ? undefined : 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <FontAwesome6 name={s.icon} size={18} color={C.coral} solid style={{ marginTop: 4 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.heading, fontSize: 18, fontWeight: '800' }}>{s.stat}</Text>
                  <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{s.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ---- HOW IT WORKS ---- */}
        <View onLayout={onSectionLayout('how')}>
          <Section pad={{ paddingTop: 88, paddingBottom: 40 }}>
            <Header eyebrow="How it works" title="Three steps. No depots, no detours."
              sub="Buddies don't make special trips — they carry along a journey they're already taking by public transport, bike or on foot." />
            <Grid narrow={narrow}>
              {STEPS.map((s, i) => (
                <View key={i} style={[glass(), { flex: 1, borderRadius: 18, padding: 28 }]}>
                  <IconTile icon={s.icon} />
                  <Text style={{ color: C.muted2, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16 }}>Step {i + 1}</Text>
                  <Text style={{ color: C.heading, fontSize: 21, fontWeight: '700', marginTop: 6 }}>{s.title}</Text>
                  <Text style={{ color: C.body, fontSize: 15.5, lineHeight: 24, marginTop: 10 }}>{s.body}</Text>
                </View>
              ))}
            </Grid>
          </Section>
        </View>

        {/* ---- COST-SHARING CAP EXPLAINER ---- */}
        <View onLayout={onSectionLayout('model')}>
          <Section pad={{ paddingTop: 32, paddingBottom: 32 }}>
            <View style={[glass(), { borderRadius: 28, padding: narrow ? 28 : 44, flexDirection: narrow ? 'column' : 'row', gap: 48, alignItems: 'center' }]}>
              <View style={{ flex: 1, width: '100%' }}>
                <Eyebrow>The cost-sharing cap</Eyebrow>
                <Text style={{ color: C.heading, fontSize: narrow ? 30 : 38, lineHeight: narrow ? 36 : 44, fontWeight: '800', letterSpacing: -1.1, marginTop: 12 }}>
                  The cap is enforced in our database — not just our terms.
                </Text>
                <Text style={{ color: C.body, fontSize: 16.5, lineHeight: 26, marginTop: 16 }}>
                  Every contribution is checked against the cap inside the same transaction that records it.
                  A Buddy shares costs and never turns a profit — that's what keeps pBuddy a genuine cost-sharing
                  community rather than a transport business.
                </Text>
                <View style={{ gap: 12, marginTop: 22 }}>
                  {CAP_POINTS.map((p, i) => <CheckRow key={i} text={p} />)}
                </View>
              </View>
              <View style={{ flex: 1, width: '100%' }}>
                <CapMeter />
              </View>
            </View>
          </Section>
        </View>

        {/* ---- TRUST & SAFETY ---- */}
        <View onLayout={onSectionLayout('trust')}>
          <Section pad={{ paddingTop: 56, paddingBottom: 40 }}>
            <Header eyebrow="Trust & safety" title="Compliance built in, not bolted on."
              sub="Every safeguard runs on every trip — verified people, sealed and declared parcels, protected contributions." />
            <Grid narrow={narrow}>
              {SAFETY.map((f, i) => (
                <View key={i} style={[glass(), { flexBasis: narrow ? undefined : '31%', flexGrow: 1, borderRadius: 18, padding: 26 }]}>
                  <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome6 name={f.icon} size={21} color={C.coral} solid />
                  </View>
                  <Text style={{ color: C.heading, fontSize: 18.5, fontWeight: '700', marginTop: 16 }}>{f.title}</Text>
                  <Text style={{ color: C.body, fontSize: 15, lineHeight: 22.5, marginTop: 8 }}>{f.body}</Text>
                </View>
              ))}
            </Grid>
          </Section>
        </View>

        {/* ---- GREENER BAND ---- */}
        <Section pad={{ paddingTop: 16, paddingBottom: 16 }}>
          <View style={[glass(), { borderRadius: 18, paddingVertical: 30, paddingHorizontal: 36, flexDirection: narrow ? 'column' : 'row', gap: 20, alignItems: narrow ? 'flex-start' : 'center' }]}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome6 name="leaf" size={24} color={C.green} solid />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.heading, fontSize: 21, fontWeight: '800' }}>A greener way to send.</Text>
              <Text style={{ color: C.body, fontSize: 15.5, lineHeight: 23, marginTop: 6 }}>
                Because parcels ride along journeys already happening by train, bus, bike or on foot, a pBuddy trip
                adds <Text style={{ color: C.heading, fontWeight: '700' }}>no extra vehicle to the road</Text> — lower-carbon than commissioning a separate
                dedicated van trip for the same route.
              </Text>
            </View>
            <Text style={{ color: C.muted2, fontSize: 12, fontWeight: '600', maxWidth: 150 }}>Comparative claim · methodology available</Text>
          </View>
        </Section>

        {/* ---- CORRIDORS ---- */}
        <View onLayout={onSectionLayout('corridors')}>
          <Section pad={{ paddingTop: 56, paddingBottom: 32 }}>
            <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 40, alignItems: 'center' }}>
              <View style={{ flex: narrow ? undefined : 0.9, width: '100%' }}>
                <Eyebrow>Corridors</Eyebrow>
                <Text style={{ color: C.heading, fontSize: narrow ? 30 : 38, lineHeight: narrow ? 36 : 44, fontWeight: '800', letterSpacing: -1.1, marginTop: 12 }}>
                  We open one route at a time.
                </Text>
                <Text style={{ color: C.body, fontSize: 16.5, lineHeight: 26, marginTop: 14 }}>
                  Each corridor is allowlisted and seeded with regular travellers before it goes live — so there's
                  always a verified buddy heading your way. More routes are joining the waitlist now.
                </Text>
                <Pressable onPress={() => router.push('/parcel/new')} style={{ marginTop: 24 }}>
                  <Text style={{ color: C.coral, fontSize: 15, fontWeight: '700' }}>Request your corridor →</Text>
                </Pressable>
              </View>
              <View style={{ flex: narrow ? undefined : 1.1, width: '100%', gap: 14 }}>
                {CORRIDORS.map((c, i) => (
                  <View key={i} style={[glass(), { borderRadius: 18, paddingVertical: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
                    <FontAwesome6 name={c.icon} size={18} color={C.coral} solid />
                    <Text style={{ color: C.heading, fontSize: 17, fontWeight: '700', flex: 1 }}>{c.route}</Text>
                    <Text style={{ color: C.muted, fontSize: 13 }}>{c.note}</Text>
                    <Badge live={c.live} label={c.status} />
                  </View>
                ))}
              </View>
            </View>
          </Section>
        </View>

        {/* ---- TWO-AUDIENCE CTA ---- */}
        <View onLayout={onSectionLayout('cta')}>
          <Section pad={{ paddingTop: 32, paddingBottom: 56 }}>
            <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 22 }}>
              <View style={{ flex: 1, borderRadius: 26, padding: 40, backgroundColor: C.coral, shadowColor: C.coral, shadowOpacity: 0.3, shadowRadius: 60, shadowOffset: { width: 0, height: 24 } }}>
                <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome6 name="box" size={21} color="#fff" solid />
                </View>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 18 }}>Sending something?</Text>
                <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 25, marginTop: 12, maxWidth: 340 }}>
                  Post your sealed parcel, match with a verified Buddy on your corridor, and share their journey cost.
                </Text>
                <Pressable onPress={() => router.push('/parcel/new')} style={{ alignSelf: 'flex-start', marginTop: 24, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 }}>
                  <Text style={{ color: C.coral, fontSize: 15, fontWeight: '700' }}>Send a parcel</Text>
                </Pressable>
              </View>
              <View style={[glass(), { flex: 1, borderRadius: 26, padding: 40 }]}>
                <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome6 name="route" size={21} color={C.coral} solid />
                </View>
                <Text style={{ color: C.heading, fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 18 }}>Travelling anyway?</Text>
                <Text style={{ color: C.body, fontSize: 16, lineHeight: 25, marginTop: 12, maxWidth: 340 }}>
                  Become a Buddy, carry along a trip you're already making, and have senders share your costs.
                  You choose what, when and how — with a full right to refuse.
                </Text>
                <BtnSolid icon="route" label="Become a buddy" onPress={() => router.push('/trip/new')} style={{ alignSelf: 'flex-start', marginTop: 24 }} />
              </View>
            </View>
          </Section>
        </View>

        {/* ---- FAQ ---- */}
        <Section max={820} pad={{ paddingTop: 8, paddingBottom: 56 }}>
          <Text style={{ color: C.heading, fontSize: 34, fontWeight: '800', letterSpacing: -1, textAlign: 'center', marginBottom: 28 }}>Questions, answered.</Text>
          <View style={{ gap: 12 }}>
            {FAQS.map((q, i) => (
              <Pressable key={i} onPress={() => setOpenFaq(openFaq === i ? null : i)} style={[glass(), { borderRadius: 18, paddingVertical: 20, paddingHorizontal: 24 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: C.heading, fontSize: 17, fontWeight: '700', flex: 1 }}>{q.q}</Text>
                  <FontAwesome6 name="chevron-down" size={14} color={C.coral} solid style={{ transform: [{ rotate: openFaq === i ? '180deg' : '0deg' }] }} />
                </View>
                {openFaq === i ? <Text style={{ color: C.body, fontSize: 15.5, lineHeight: 25, marginTop: 12 }}>{q.a}</Text> : null}
              </Pressable>
            ))}
          </View>
        </Section>

        {/* ---- FOOTER ---- */}
        <View style={[Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px)' } as unknown as ViewStyle) : null, { backgroundColor: 'rgba(255,255,255,0.45)', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' }]}>
          <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 44, flexDirection: narrow ? 'column' : 'row', gap: 32 }}>
            <View style={{ flex: narrow ? undefined : 1.4 }}>
              <Logo />
              <Text style={{ color: C.muted2, fontSize: 13.5, lineHeight: 22, marginTop: 14, maxWidth: 340 }}>
                pBuddy is a cost-sharing community that connects senders with buddies already travelling.
                It is not a logistics, transport or hire-and-reward service.
              </Text>
            </View>
            <FooterCol title="Legal" items={['Terms & Conditions', 'Privacy Policy', 'Prohibited Items', 'Cost-sharing explainer']}
              onItem={(it) => router.push(it.startsWith('Terms') ? '/legal/terms' : it.startsWith('Privacy') ? '/legal/privacy' : it.startsWith('Prohibited') ? '/legal/prohibited_items' : '/legal/cost_sharing.explainer')} />
            <FooterCol title="Company" items={['How it works', 'Trust & safety', 'Corridors', 'Contact']}
              onItem={(it) => { if (it === 'How it works') scrollTo('how'); else if (it === 'Trust & safety') scrollTo('trust'); else if (it === 'Corridors') scrollTo('corridors'); }} />
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingVertical: 18, paddingHorizontal: 24 }}>
            <Text style={{ color: C.muted3, fontSize: 12.5, textAlign: 'center' }}>
              © 2026 pBuddy · Buddies are independent and choose their own journeys · Right-to-Work verified before carrying
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- Building blocks -----------------------------------------------------

function Section({ children, pad, max = MAXW }: { children: React.ReactNode; pad?: ViewStyle; max?: number }) {
  return (
    <View style={[{ width: '100%', maxWidth: max, alignSelf: 'center', paddingHorizontal: 24 }, pad]}>{children}</View>
  );
}

function Grid({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return <View style={{ flexDirection: narrow ? 'column' : 'row', flexWrap: narrow ? 'nowrap' : 'wrap', gap: 22 }}>{children}</View>;
}

function Nav({ narrow, onNav, onStart }: { narrow: boolean; onNav: (k: string) => void; onStart: () => void }) {
  const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as unknown as ViewStyle) : null;
  return (
    <View style={[sticky, { zIndex: 50, paddingTop: 14, paddingHorizontal: 24 }]}>
      <View style={[glass(), {
        width: '100%', maxWidth: MAXW, alignSelf: 'center', borderRadius: 999,
        paddingVertical: 12, paddingLeft: 22, paddingRight: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20,
      }]}>
        <Logo />
        {!narrow && (
          <View style={{ flexDirection: 'row', gap: 28 }}>
            {([['How it works', 'how'], ['Cost-sharing', 'model'], ['Trust & safety', 'trust'], ['Corridors', 'corridors']] as const).map(([label, key]) => (
              <Pressable key={key} onPress={() => onNav(key)}>
                <Text style={{ color: '#4a4a4a', fontSize: 14.5, fontWeight: '500' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable onPress={onStart} style={{ backgroundColor: C.coral, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20 }}>
          <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>p</Text>
      </View>
      <Text style={{ color: C.heading, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>pBuddy</Text>
    </View>
  );
}

function Eyebrow({ children, pill }: { children: React.ReactNode; pill?: boolean }) {
  if (pill) {
    return (
      <View style={[glass(), { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 }]}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral }} />
        <Text style={{ color: C.coralDark, fontSize: 13, fontWeight: '600' }}>{children}</Text>
      </View>
    );
  }
  return <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>;
}

function Header({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <View style={{ alignItems: 'center', maxWidth: 640, alignSelf: 'center', marginBottom: 44 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={{ color: C.heading, fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.1, textAlign: 'center', marginTop: 12 }}>{title}</Text>
      <Text style={{ color: C.body, fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 14 }}>{sub}</Text>
    </View>
  );
}

function IconTile({ icon }: { icon: FAName }) {
  return (
    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
      <FontAwesome6 name={icon} size={19} color="#fff" solid />
    </View>
  );
}

function BtnSolid({ icon, label, onPress, style }: { icon: FAName; label: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.coral, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 28 }, style]}>
      <FontAwesome6 name={icon} size={16} color="#fff" solid />
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function BtnGlass({ icon, label, onPress }: { icon: FAName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[glass(), { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 28 }]}>
      <FontAwesome6 name={icon} size={16} color={C.heading} solid />
      <Text style={{ color: C.heading, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function TrustInline({ icon, text }: { icon: FAName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <FontAwesome6 name={icon} size={14} color={C.coral} solid />
      <Text style={{ color: C.muted, fontSize: 13.5, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <FontAwesome6 name="check" size={12} color={C.green} solid />
      </View>
      <Text style={{ color: '#3a3a3d', fontSize: 15.5, lineHeight: 21, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Badge({ live, label }: { live: boolean; label: string }) {
  return (
    <View style={{ backgroundColor: live ? C.greenBg : 'rgba(255,90,95,0.14)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: live ? C.green : C.coralStatus, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Blob({ color, style }: { color: string; style: ViewStyle }) {
  return (
    <View style={[{ position: 'absolute', width: 600, height: 600, borderRadius: 300, backgroundColor: color, opacity: 0.7 }, Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as unknown as ViewStyle) : null, style]} />
  );
}

function HeroCard() {
  return (
    <View style={{ width: 322, maxWidth: '100%' }}>
      {/* floating "sealed" badge */}
      <View style={[glass(), { borderRadius: 18, padding: 16, marginBottom: 14 }]}>
        <Text style={{ color: C.muted2, fontSize: 12, fontWeight: '600' }}>Sealed parcel · right to refuse</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome6 name="shield-halved" size={12} color={C.green} solid />
          </View>
          <Text style={{ color: C.heading, fontSize: 14, fontWeight: '700' }}>Declared & accepted</Text>
        </View>
      </View>

      <View style={[glass(), { borderRadius: 30, padding: 22, shadowOpacity: 0.2, shadowRadius: 70 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.muted2, fontSize: 13, fontWeight: '600' }}>Corridor</Text>
          <Text style={{ color: C.coral, fontSize: 13, fontWeight: '600' }}>● live</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Text style={{ color: C.heading, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 }}>London</Text>
          <FontAwesome6 name="arrow-right-long" size={16} color={C.coral} solid />
          <Text style={{ color: C.heading, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 }}>Manchester</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <FontAwesome6 name="train" size={12} color={C.muted} solid />
          <Text style={{ color: C.muted, fontSize: 13 }}>Train · Saturday · departs 10:24</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.avatarBg, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome6 name="user" size={18} color={C.avatarFg} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.heading, fontSize: 15, fontWeight: '700' }}>Aisha K.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <FontAwesome6 name="circle-check" size={11} color={C.green} solid />
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>Right-to-Work verified</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.heading, fontSize: 13, fontWeight: '700' }}>4.96</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <FontAwesome6 name="star" size={10} color={C.amber} solid />
              <Text style={{ color: C.muted2, fontSize: 11 }}>38 trips</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.muted, fontSize: 12.5, fontWeight: '600' }}>Your contribution</Text>
            <Text style={{ color: C.muted, fontSize: 12.5, fontWeight: '600' }}>Journey cost £38</Text>
          </View>
          <View style={{ height: 12, borderRadius: 999, backgroundColor: C.line, marginTop: 8, overflow: 'hidden' }}>
            <View style={{ height: 12, width: '68%', borderRadius: 999, backgroundColor: C.coral }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
            <Text style={{ color: C.heading, fontSize: 24, fontWeight: '800' }}>£26</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <FontAwesome6 name="circle-check" size={11} color={C.green} solid />
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>within cost-sharing cap</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: C.coral, borderRadius: 16, paddingVertical: 14, marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Share the journey</Text>
        </View>
      </View>
    </View>
  );
}

function CapMeter() {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', padding: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <FontAwesome6 name="train" size={13} color={C.muted2} solid />
        <Text style={{ color: C.muted2, fontSize: 13, fontWeight: '600' }}>Trip: London → Manchester</Text>
      </View>
      <View style={{ gap: 16, marginTop: 18 }}>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>Buddy's journey cost</Text>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>£38.00</Text>
          </View>
          <View style={{ height: 14, borderRadius: 999, backgroundColor: C.line, marginTop: 7 }} />
        </View>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>Total contributions</Text>
            <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800' }}>£26.00</Text>
          </View>
          <View style={{ height: 14, borderRadius: 999, backgroundColor: C.line, marginTop: 7, overflow: 'hidden' }}>
            <View style={{ height: 14, width: '68%', borderRadius: 999, backgroundColor: C.coral }} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,90,95,0.4)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome6 name="ban" size={13} color="#fff" solid />
        </View>
        <Text style={{ color: '#3a3a3d', fontSize: 13.5, fontWeight: '600', flex: 1, lineHeight: 18 }}>
          Any contribution that would pass £38 is rejected automatically at the database.
        </Text>
      </View>
    </View>
  );
}

function FooterCol({ title, items, onItem }: { title: string; items: string[]; onItem: (i: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.heading, fontSize: 13, fontWeight: '700', marginBottom: 12 }}>{title}</Text>
      <View style={{ gap: 9 }}>
        {items.map((it) => (
          <Pressable key={it} onPress={() => onItem(it)}>
            <Text style={{ color: C.muted, fontSize: 13.5 }}>{it}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---- Static content (per the handoff spec) -------------------------------

const STATS: { icon: FAName; stat: string; label: string }[] = [
  { icon: 'id-card', stat: 'All buddies', label: 'Right-to-Work verified before they can carry' },
  { icon: 'lock', stat: 'Escrow', label: 'contributions held safely until handover' },
  { icon: 'gauge', stat: 'Capped', label: 'contributions never exceed the journey cost' },
  { icon: 'leaf', stat: 'Greener', label: 'rides along journeys already happening' },
];

const STEPS: { icon: FAName; title: string; body: string }[] = [
  { icon: 'box', title: 'Post your sealed parcel', body: "Seal your parcel and declare what's inside. We check it against the prohibited-items list — the Buddy keeps a full right to refuse." },
  { icon: 'route', title: 'Match on a corridor', body: 'We connect you with a verified Buddy already travelling your route by train, bus, bike or on foot — no special trips, no detours.' },
  { icon: 'handshake', title: 'Share the journey cost', body: "Your contribution goes into escrow and releases on handover. It's a share of the trip, capped at what it actually cost." },
];

const CAP_POINTS = [
  "Each trip has a cap equal to the Buddy's own journey cost.",
  'Contributions are checked against that cap in the same database transaction that records them.',
  'Any contribution that would tip past the cap is rejected automatically.',
];

const SAFETY: { icon: FAName; title: string; body: string }[] = [
  { icon: 'id-card', title: 'Right-to-Work verified', body: 'Every Buddy completes Right-to-Work verification before they can carry anything — and a substitute Buddy is re-checked before they take over.' },
  { icon: 'lock', title: 'Contributions held in escrow', body: 'Contributions are held securely by our payments partner and only release once the parcel is handed over.' },
  { icon: 'box-open', title: 'Sealed parcel, right to refuse', body: 'Parcels travel sealed with a sender declaration — no inspection step — and the Buddy can refuse any parcel, for any reason.' },
  { icon: 'shield-halved', title: 'Prohibited items screened', body: 'Listings are screened against a clear prohibited-items policy, with a report flow so anything concerning reaches our team.' },
  { icon: 'file-shield', title: 'An immutable audit trail', body: 'Every compliance-relevant decision is written to an append-only, hash-chained log — transparency you can rely on.' },
  { icon: 'umbrella', title: 'Optional cover at checkout', body: "Senders can add optional cover for a parcel at checkout. It's never mandatory, and we never claim a parcel is fully covered or guaranteed." },
];

const CORRIDORS: { icon: FAName; route: string; note: string; status: string; live: boolean }[] = [
  { icon: 'train', route: 'London → Manchester', note: 'Roster seeded', status: 'Live', live: true },
  { icon: 'train', route: 'Manchester → London', note: 'Roster seeded', status: 'Live', live: true },
  { icon: 'bus', route: 'Birmingham ↔ Leeds', note: 'Waitlist open', status: 'Soon', live: false },
];

const FAQS = [
  { q: 'How does cost-sharing actually work?', a: "A Buddy already making a journey shares the cost of that trip with the people sending parcels along it. The total of everyone's contributions is capped at the Buddy's own journey cost — enforced in our database — so they share expenses rather than profit from the trip." },
  { q: 'Who is allowed to carry a parcel?', a: 'Every Buddy completes Right-to-Work verification before they can carry anything at all. If a Buddy passes a trip to a substitute, that person is verified too before they take over.' },
  { q: 'Do you open and inspect my parcel?', a: 'No. Parcels travel sealed with a sender declaration of the contents — there’s no open-box inspection. The Buddy keeps a full right to refuse any parcel, and listings are screened against our prohibited-items policy.' },
  { q: 'Can students take part?', a: 'Students are welcome to send parcels. Carrying as a Buddy is not available to students — only senders who are not carrying can take part on a student visa.' },
  { q: 'Is my parcel covered?', a: "Cover is an optional bolt-on the sender can add at checkout — it's never mandatory, and we never describe a parcel as fully covered or guaranteed. Your contribution is always held in escrow until handover." },
];
