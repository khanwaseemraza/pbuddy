// Public marketing landing — consumer-first (Senders + Buddies). Benefit-led,
// plain English, no jargon. Copy is the audit-clean deck from the landing-copy
// workflow (certified by employment-law + ads/scam lenses, 0 kill/high issues).
// HARD RULES (design/DESIGN-BRIEF.md + PBD-144/145): no emoji (FontAwesome only),
// no gradients (solid coral), Airbnb + glassmorphism, framing-clean, greener
// public/bike/foot scope. Compliance DEPTH lives on /trust, not here.
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, View,
  useWindowDimensions, type LayoutChangeEvent, type ViewStyle,
} from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useAuth } from '../src/auth/AuthProvider';
import { C, glass, MAXW } from '../src/components/glass';

type FAName = React.ComponentProps<typeof FontAwesome6>['name'];

export default function Index() {
  const { user, loading } = useAuth();
  // Preload the FontAwesome web font so icons render instead of tofu squares
  // (Expo's static web export doesn't auto-register the icon @font-face).
  const [fontsLoaded, fontError] = useFonts(FontAwesome6.font);
  const iconsReady = fontsLoaded || !!fontError;
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
  // Nav/footer links: 'trust' is a real page; the rest scroll in-page.
  const onLink = (key: string) => { if (key === 'trust') router.push('/trust' as Href); else scrollTo(key); };

  if (loading || !iconsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.coral} />
      </View>
    );
  }
  if (user) return <Redirect href="/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' } as ViewStyle}>
          <Blob color={C.blob1} style={{ top: -160, left: -120 }} />
          <Blob color={C.blob2} style={{ top: 120, right: -160 }} />
          <Blob color={C.blob3} style={{ bottom: -200, left: '30%' }} />
        </View>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }}>
        <Nav narrow={narrow} onLink={onLink} onStart={() => router.push('/parcel/new')} />

        {/* ---- HERO ---- */}
        <Section pad={{ paddingTop: 96, paddingBottom: 40 }}>
          <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 48, alignItems: 'center' }}>
            <View style={{ flex: narrow ? undefined : 1.05, width: '100%' }}>
              <Eyebrow pill>A simpler, lower-cost way to send a parcel</Eyebrow>
              <Text style={{ color: C.heading, fontSize: narrow ? 40 : 60, lineHeight: narrow ? 44 : 62, fontWeight: '800', letterSpacing: -1.6, marginTop: 22 }}>
                Someone's already going your way.
              </Text>
              <Text style={{ color: C.body, fontSize: 19, lineHeight: 29, marginTop: 22, maxWidth: 520 }}>
                pBuddy connects you with a verified Buddy already making your journey by train, bus, coach,
                bike or on foot. They bring your parcel along, and you <Text style={{ color: C.heading, fontWeight: '700' }}>share a fair part of what
                the trip already costs</Text> — nothing more.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
                <BtnSolid icon="box" label="Send a parcel" onPress={() => router.push('/parcel/new')} />
                <BtnGlass icon="route" label="Already travelling? Share your trip" onPress={() => router.push('/trip/new')} />
              </View>
              <View style={{ gap: 10, marginTop: 28 }}>
                {HERO_TRUST.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <FontAwesome6 name="circle-check" size={14} color={C.coral} solid style={{ marginTop: 3 }} />
                    <Text style={{ color: C.muted, fontSize: 13.5, fontWeight: '600', flex: 1 }}>{t}</Text>
                  </View>
                ))}
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
                  <Text style={{ color: C.heading, fontSize: 16, fontWeight: '800' }}>{s.stat}</Text>
                  <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{s.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ---- HOW IT WORKS ---- */}
        <View onLayout={onSectionLayout('how')}>
          <Section pad={{ paddingTop: 88, paddingBottom: 40 }}>
            <Header eyebrow="How it works" title="Three simple steps."
              sub="One journey that's already happening, shared between two people." />
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

        {/* ---- VALUE: you never overpay ---- */}
        <View onLayout={onSectionLayout('model')}>
          <Section pad={{ paddingTop: 32, paddingBottom: 32 }}>
            <View style={[glass(), { borderRadius: 28, padding: narrow ? 28 : 44, flexDirection: narrow ? 'column' : 'row', gap: 48, alignItems: 'center' }]}>
              <View style={{ flex: 1, width: '100%' }}>
                <Eyebrow>You never overpay</Eyebrow>
                <Text style={{ color: C.heading, fontSize: narrow ? 30 : 38, lineHeight: narrow ? 36 : 44, fontWeight: '800', letterSpacing: -1.1, marginTop: 12 }}>
                  You share the journey. Not a penny more.
                </Text>
                <Text style={{ color: C.body, fontSize: 16.5, lineHeight: 26, marginTop: 16 }}>
                  Your Buddy is already making the trip, so you're not paying for a journey from scratch. You simply
                  share a part of what their travel actually costs, and that share is capped so it can never climb
                  above the real cost of the trip.
                </Text>
                <View style={{ gap: 12, marginTop: 22 }}>
                  {VALUE_POINTS.map((p, i) => <CheckRow key={i} text={p} />)}
                </View>
              </View>
              <View style={{ flex: 1, width: '100%' }}>
                <CapMeter />
              </View>
            </View>
          </Section>
        </View>

        {/* ---- SAFETY TEASER (depth lives on /trust) ---- */}
        <Section pad={{ paddingTop: 56, paddingBottom: 24 }}>
          <Header eyebrow="Sent with care" title="Sent with care, every step."
            sub="A few simple things that keep every send safe." />
          <Grid narrow={narrow}>
            {SAFETY.map((f, i) => (
              <View key={i} style={[glass(), { flex: 1, borderRadius: 18, padding: 26 }]}>
                <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome6 name={f.icon} size={21} color={C.coral} solid />
                </View>
                <Text style={{ color: C.heading, fontSize: 18.5, fontWeight: '700', marginTop: 16 }}>{f.title}</Text>
                <Text style={{ color: C.body, fontSize: 15, lineHeight: 22.5, marginTop: 8 }}>{f.body}</Text>
              </View>
            ))}
          </Grid>
          <Pressable onPress={() => router.push('/trust' as Href)} style={{ alignSelf: 'center', marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.coral, fontSize: 15, fontWeight: '700' }}>See how we keep you safe</Text>
            <FontAwesome6 name="arrow-right-long" size={14} color={C.coral} solid />
          </Pressable>
        </Section>

        {/* ---- GREENER BAND ---- */}
        <Section pad={{ paddingTop: 16, paddingBottom: 16 }}>
          <View style={[glass(), { borderRadius: 18, paddingVertical: 30, paddingHorizontal: 36, flexDirection: narrow ? 'column' : 'row', gap: 20, alignItems: narrow ? 'flex-start' : 'center' }]}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome6 name="leaf" size={24} color={C.green} solid />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.heading, fontSize: 21, fontWeight: '800' }}>A greener way to send.</Text>
              <Text style={{ color: C.body, fontSize: 15.5, lineHeight: 23, marginTop: 6 }}>
                Your parcel rides along on a journey that's already happening, so there's no extra van on the road
                just for it. That makes sending with pBuddy a lower-carbon choice than a trip laid on for one
                parcel alone.
              </Text>
            </View>
            <Text style={{ color: C.muted2, fontSize: 12, fontWeight: '600', maxWidth: 160 }}>A comparative claim against a dedicated trip for the same parcel.</Text>
          </View>
        </Section>

        {/* ---- CORRIDORS ---- */}
        <View onLayout={onSectionLayout('corridors')}>
          <Section pad={{ paddingTop: 56, paddingBottom: 32 }}>
            <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 40, alignItems: 'center' }}>
              <View style={{ flex: narrow ? undefined : 0.9, width: '100%' }}>
                <Eyebrow>Routes</Eyebrow>
                <Text style={{ color: C.heading, fontSize: narrow ? 30 : 38, lineHeight: narrow ? 36 : 44, fontWeight: '800', letterSpacing: -1.1, marginTop: 12 }}>
                  Popular routes near you.
                </Text>
                <Text style={{ color: C.body, fontSize: 16.5, lineHeight: 26, marginTop: 14 }}>
                  People are travelling between Britain's towns and cities every day, and more routes open up as
                  the community grows. Chances are, your route is one of them. Don't see it? Add it and we'll look
                  for a Buddy heading your way.
                </Text>
                <Pressable onPress={() => router.push('/parcel/new')} style={{ marginTop: 24 }}>
                  <Text style={{ color: C.coral, fontSize: 15, fontWeight: '700' }}>See popular routes →</Text>
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
        <Section pad={{ paddingTop: 32, paddingBottom: 56 }}>
          <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 22 }}>
            <View style={{ flex: 1, borderRadius: 26, padding: 40, backgroundColor: C.coral, shadowColor: C.coral, shadowOpacity: 0.3, shadowRadius: 60, shadowOffset: { width: 0, height: 24 } }}>
              <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome6 name="box" size={21} color="#fff" solid />
              </View>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 18 }}>Got something to send?</Text>
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 25, marginTop: 12, maxWidth: 360 }}>
                Match with a verified Buddy already heading your way and share a fair part of what their trip costs
                — capped so you never overpay. Clear pricing, sealed parcels, and your money held until the handover.
              </Text>
              <Pressable onPress={() => router.push('/parcel/new')} style={{ alignSelf: 'flex-start', marginTop: 24, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 }}>
                <Text style={{ color: C.coral, fontSize: 15, fontWeight: '700' }}>Send a parcel</Text>
              </Pressable>
            </View>
            <View style={[glass(), { flex: 1, borderRadius: 26, padding: 40 }]}>
              <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome6 name="route" size={21} color={C.coral} solid />
              </View>
              <Text style={{ color: C.heading, fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 18 }}>Already making the trip?</Text>
              <Text style={{ color: C.body, fontSize: 16, lineHeight: 25, marginTop: 12, maxWidth: 360 }}>
                If you're travelling between cities anyway, you can bring a sealed parcel along and a Sender chips in
                toward your journey — capped to what that trip actually costs you, never more. You choose what you
                carry, and you can always say no.
              </Text>
              <BtnSolid icon="route" label="Share your trip" onPress={() => router.push('/trip/new')} style={{ alignSelf: 'flex-start', marginTop: 24 }} />
            </View>
          </View>
        </Section>

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
            <View style={{ flex: narrow ? undefined : 1.6 }}>
              <Logo />
              <Text style={{ color: C.muted2, fontSize: 13, lineHeight: 21, marginTop: 14, maxWidth: 460 }}>
                {FOOTER_BLURB}
              </Text>
            </View>
            <FooterCol title="Legal" items={['Terms & Conditions', 'Privacy Policy', 'Prohibited Items', 'Cost-sharing explainer']}
              onItem={(it) => router.push(it.startsWith('Terms') ? '/legal/terms' : it.startsWith('Privacy') ? '/legal/privacy' : it.startsWith('Prohibited') ? '/legal/prohibited_items' : '/legal/cost_sharing.explainer')} />
            <FooterCol title="Company" items={['How it works', 'Trust & safety', 'Routes']}
              onItem={(it) => { if (it === 'How it works') scrollTo('how'); else if (it === 'Trust & safety') router.push('/trust' as Href); else scrollTo('corridors'); }} />
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingVertical: 18, paddingHorizontal: 24 }}>
            <Text style={{ color: C.muted3, fontSize: 12.5, textAlign: 'center' }}>
              © 2026 pBuddy · Buddies are independent and choose their own journeys
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- Building blocks -----------------------------------------------------

function Section({ children, pad, max = MAXW }: { children: React.ReactNode; pad?: ViewStyle; max?: number }) {
  return <View style={[{ width: '100%', maxWidth: max, alignSelf: 'center', paddingHorizontal: 24 }, pad]}>{children}</View>;
}

function Grid({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return <View style={{ flexDirection: narrow ? 'column' : 'row', flexWrap: narrow ? 'nowrap' : 'wrap', gap: 22 }}>{children}</View>;
}

function Nav({ narrow, onLink, onStart }: { narrow: boolean; onLink: (k: string) => void; onStart: () => void }) {
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
            {([['How it works', 'how'], ['You never overpay', 'model'], ['Trust & safety', 'trust'], ['Routes', 'corridors']] as const).map(([label, key]) => (
              <Pressable key={key} onPress={() => onLink(key)}>
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
          <Text style={{ color: C.muted2, fontSize: 13, fontWeight: '600' }}>Route</Text>
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
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>Verified Buddy</Text>
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
              <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>within the cap</Text>
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
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>What the trip really costs</Text>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>£38.00</Text>
          </View>
          <View style={{ height: 14, borderRadius: 999, backgroundColor: C.line, marginTop: 7 }} />
        </View>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>Your share</Text>
            <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800' }}>£26.00</Text>
          </View>
          <View style={{ height: 14, borderRadius: 999, backgroundColor: C.line, marginTop: 7, overflow: 'hidden' }}>
            <View style={{ height: 14, width: '68%', borderRadius: 999, backgroundColor: C.coral }} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,90,95,0.4)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome6 name="lock" size={12} color="#fff" solid />
        </View>
        <Text style={{ color: '#3a3a3d', fontSize: 13.5, fontWeight: '600', flex: 1, lineHeight: 18 }}>
          Your share is capped to what the trip really costs — never more.
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

// ---- Copy (certified, audit-clean deck) ----------------------------------

const HERO_TRUST = [
  'Identity and eligibility checked. Money held securely until handover.',
  'Sealed parcels, your declaration. Your share is capped to the real trip cost.',
];

const STATS: { icon: FAName; stat: string; label: string }[] = [
  { icon: 'id-card', stat: 'Identity-checked', label: "Every Buddy, before they're matched with a parcel" },
  { icon: 'lock', stat: 'Held securely', label: 'Your contribution waits in escrow until handover' },
  { icon: 'box', stat: 'Sealed', label: 'Parcels travel exactly as you packed them' },
  { icon: 'gauge', stat: 'Capped', label: 'You only ever share the real cost of the trip' },
];

const STEPS: { icon: FAName; title: string; body: string }[] = [
  { icon: 'box', title: "Tell us where it's headed", body: "Pop in the destination and the day, plus a short description of your parcel in your own words. We'll look for a verified Buddy already going that way." },
  { icon: 'user', title: 'Meet your Buddy', body: "We introduce you to a verified Buddy already making that journey. You'll see who you're matched with before anything moves, and your contribution is held securely by our payments partner until handover." },
  { icon: 'handshake', title: 'Handover, confirmed', body: "Your sealed parcel travels along a trip that was already happening. Your contribution stays held until you and your Buddy both confirm it's changed hands — nothing is released before that." },
];

const VALUE_POINTS = [
  "A fair share, by design. Your contribution is capped to your Buddy's real travel cost. It can't climb above it.",
  'What you see is what you pay. One clear figure before you confirm, with nothing added at checkout.',
  "Cost-sharing, not a margin. This is two people sharing one journey's cost — nothing marked up, nothing skimmed on top.",
];

const SAFETY: { icon: FAName; title: string; body: string }[] = [
  { icon: 'id-card', title: 'Verified people', body: "Every Buddy passes identity and eligibility checks before they're matched with a parcel." },
  { icon: 'lock', title: 'Your money, held safely', body: 'Your contribution sits in escrow with our payments partner and is only released once your parcel is handed over.' },
  { icon: 'box-open', title: 'Sealed, and you stay in control', body: "Parcels travel sealed with your declaration, and any Buddy can refuse a parcel they'd rather not take." },
];

const CORRIDORS: { icon: FAName; route: string; note: string; status: string; live: boolean }[] = [
  { icon: 'train', route: 'London → Manchester', note: 'Roster seeded', status: 'Live', live: true },
  { icon: 'train', route: 'Manchester → London', note: 'Roster seeded', status: 'Live', live: true },
  { icon: 'bus', route: 'Birmingham ↔ Leeds', note: 'Waitlist open', status: 'Soon', live: false },
];

const FAQS = [
  { q: 'How much does it cost to send a parcel?', a: "You share a part of your Buddy's journey cost, and that share is capped so it can never be more than the trip actually costs. You'll see one clear figure before you confirm, with nothing added later." },
  { q: 'Who are the Buddies?', a: "Buddies are everyday people already making that journey themselves — by train, bus, coach, bike or on foot. Every Buddy is identity- and eligibility-checked before they can accept a parcel along their own journey, so you can see exactly who you're matched with before you book." },
  { q: 'When does my Buddy receive my contribution?', a: 'Not until your parcel is handed over. Your contribution is held securely by our payments partner from the moment you book, and is only released once you and your Buddy both confirm the handover.' },
  { q: 'Does anyone open or inspect my parcel?', a: "No. Your parcel travels sealed, exactly as you packed it, alongside a short description you provide. Your Buddy can always choose to refuse a parcel, but there's no opening or inspection step." },
  { q: 'Can I be a Buddy?', a: "If you're already travelling between UK cities, you can apply and go through an identity and eligibility check first. Students can send parcels with pBuddy, but can't carry as a Buddy." },
];

const FOOTER_BLURB = "pBuddy is a cost-sharing marketplace. We introduce Senders to verified Buddies who are already making the same journey, so the cost of that journey can be shared. pBuddy is not a courier, delivery, logistics or transport company, does not employ Buddies and does not carry parcels itself, and a Buddy does not make a profit from sharing a journey. Contributions are capped so they never exceed the Buddy's own journey cost. Buddies are identity- and eligibility-checked before they can carry. Optional cover is available at checkout. Available for journeys within the UK only.";
