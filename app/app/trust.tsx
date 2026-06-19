// Public "Trust & safety" page — the compliance depth, in plain English, for a
// worried consumer or a journalist (NOT regulators-only legalese). Copy is the
// audit-clean deck from the landing-copy workflow (0 kill/high issues). The
// landing links here; the binding wording lives in /legal. No emoji, no gradients.
import { useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Text, View, type ViewStyle,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { C, glass } from '../src/components/glass';

type FAName = React.ComponentProps<typeof FontAwesome6>['name'];
const MAXW = 860;

export default function Trust() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts(FontAwesome6.font);
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={C.coral} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' } as ViewStyle}>
          <Blob color={C.blob1} style={{ top: -180, right: -120 }} />
          <Blob color={C.blob3} style={{ bottom: -200, left: -100 }} />
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 56 }}>
        {/* header */}
        <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>p</Text>
              </View>
              <Text style={{ color: C.heading, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>pBuddy</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <FontAwesome6 name="arrow-left-long" size={13} color={C.muted} solid />
              <Text style={{ color: C.muted, fontSize: 14.5, fontWeight: '600' }}>Back to home</Text>
            </Pressable>
          </View>
        </View>

        {/* title + intro */}
        <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 40 }}>
          <Text style={{ color: C.coral, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Trust & safety</Text>
          <Text style={{ color: C.heading, fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.4, marginTop: 12 }}>
            Trust and safety at pBuddy
          </Text>
          <Text style={{ color: C.body, fontSize: 18, lineHeight: 28, marginTop: 16 }}>
            pBuddy connects you with a verified Buddy who is already heading your way, so your parcel travels on a
            journey that's already happening instead of triggering a trip of its own. Here's how pBuddy keeps every
            journey fair and safe — in plain English, the way it should be.
          </Text>
        </View>

        {/* sections */}
        <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 24, marginTop: 32, gap: 16 }}>
          {SECTIONS.map((s, i) => (
            <View key={i} style={[glass(), { borderRadius: 22, padding: 28 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome6 name={s.icon} size={20} color={C.coral} solid />
                </View>
                <Text style={{ color: C.heading, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, flex: 1 }}>{s.heading}</Text>
              </View>
              <Text style={{ color: C.body, fontSize: 15.5, lineHeight: 24, marginTop: 14 }}>{s.body}</Text>
              <View style={{ gap: 10, marginTop: 16 }}>
                {s.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <FontAwesome6 name="check" size={11} color={C.green} solid />
                    </View>
                    <Text style={{ color: '#3a3a3d', fontSize: 15, lineHeight: 21, flex: 1 }}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* closing CTA */}
        <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', paddingHorizontal: 24, marginTop: 28 }}>
          <View style={[glass(), { borderRadius: 22, padding: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }]}>
            <Text style={{ color: C.heading, fontSize: 18, fontWeight: '800', flex: 1, minWidth: 220 }}>
              Ready to send something the fairer way?
            </Text>
            <Pressable onPress={() => router.push('/parcel/new')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.coral, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 }}>
              <FontAwesome6 name="box" size={15} color="#fff" solid />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Send a parcel</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 18, justifyContent: 'center' }}>
            {[['Terms & Conditions', '/legal/terms'], ['Privacy Policy', '/legal/privacy'], ['Prohibited Items', '/legal/prohibited_items'], ['Cost-sharing explainer', '/legal/cost_sharing.explainer']].map(([label, href]) => (
              <Pressable key={href} onPress={() => router.push(href as never)}>
                <Text style={{ color: C.muted, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Blob({ color, style }: { color: string; style: ViewStyle }) {
  return (
    <View style={[{ position: 'absolute', width: 560, height: 560, borderRadius: 280, backgroundColor: color, opacity: 0.6 }, Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as unknown as ViewStyle) : null, style]} />
  );
}

const SECTIONS: { icon: FAName; heading: string; body: string; bullets: string[] }[] = [
  {
    icon: 'gauge',
    heading: 'You share the cost — you never overpay',
    body: 'With pBuddy you simply share the cost of a journey that was already happening. The Sender pays a contribution toward that trip, and the contribution is capped to the real cost of the journey. Because of the cap, your contribution can never be more than the journey actually costs — it only helps cover a trip the Buddy was already taking.',
    bullets: [
      "The contribution is capped to the Buddy's own journey cost.",
      'You never pay more than the journey actually costs.',
      'A Buddy never turns a profit — they simply share the cost of a journey they were already making.',
    ],
  },
  {
    icon: 'id-card',
    heading: 'Who can carry — every Buddy is checked first',
    body: 'Every Buddy has their identity confirmed and their eligibility to carry parcels in the UK checked before they ever match with a Sender — so the person sharing your journey is always verified. No one carries until those checks have passed. Students are welcome to send parcels, but they cannot sign up to carry as a Buddy — so when you send, you can be confident the Buddy travelling the same way has been verified.',
    bullets: [
      'Identity confirmed before a Buddy can carry anything.',
      'Eligibility to carry parcels in the UK checked before any match.',
      'Students can send, but cannot carry as a Buddy.',
    ],
  },
  {
    icon: 'box-open',
    heading: 'Sealed parcels, and a Buddy who can always say no',
    body: "Every parcel travels sealed, with a short declaration from the Sender describing what's inside. Your parcel stays sealed the whole way — the Buddy never opens it, and we never ask them to. In return, a Buddy is always free to refuse any parcel for any reason before the journey begins, which keeps the arrangement honest and comfortable on both sides.",
    bullets: [
      "Parcels travel sealed with a Sender's declaration of the contents.",
      'No open-box inspection — the Buddy never opens your parcel.',
      'The Buddy can refuse any parcel, for any reason, before the journey begins.',
    ],
  },
  {
    icon: 'lock',
    heading: 'Your money is held securely until handover',
    body: "When you book, your contribution is held securely by pBuddy in escrow rather than going straight to the Buddy. It's only released once the Buddy and recipient confirm the handover at the other end. That way, your money stays protected throughout the journey, and the Buddy knows their share is ready and waiting.",
    bullets: [
      'Your contribution is held in escrow, not paid out up front.',
      "It's released only once the handover is confirmed at the other end.",
      'Your money stays protected for the whole journey.',
    ],
  },
  {
    icon: 'shield-halved',
    heading: 'Prohibited items and reporting',
    body: 'Some things must never travel through pBuddy — including anything illegal, dangerous, perishable, or not allowed to travel on the kind of journey the Buddy is making. Senders agree to our prohibited-items list and declare honestly what they\'re sending before booking. A Buddy can always refuse a parcel, and either side can report a concern in the app — we review every report and can suspend accounts that break the rules.',
    bullets: [
      'A clear prohibited-items list every Sender agrees to.',
      "Senders declare honestly what they're sending before booking.",
      'Either side can report a concern in the app — we review every report and can suspend accounts that break the rules.',
    ],
  },
  {
    icon: 'umbrella',
    heading: 'Optional cover at checkout',
    body: "At checkout you can choose to add optional cover for your parcel for extra peace of mind. It's entirely your choice — cover is never automatic and never required to send. We're always straight with you about what it does and doesn't include, so you can decide what's right for what you're sending.",
    bullets: [
      'Cover is optional — never automatic, never required to send.',
      "We're clear about exactly what it does and doesn't include.",
      "You decide what's right for what you're sending.",
    ],
  },
  {
    icon: 'leaf',
    heading: 'A greener way to send',
    body: "Because your parcel travels on a journey that's already happening — by train, bus, coach, bicycle or on foot — there's no separate van trip taken just to move it. For many trips, that's a lower-carbon way to send than booking a vehicle just for your parcel.",
    bullets: [
      "Your parcel rides a journey that's already happening.",
      'No separate vehicle trip is taken just to move it.',
      'For many trips, a lower-carbon way to send than booking a dedicated vehicle.',
    ],
  },
  {
    icon: 'user',
    heading: 'Buddies travel on their own terms',
    body: 'Every Buddy is an independent traveller who decides their own journeys. They choose when and where they\'re travelling, and pick which parcels they\'re happy to carry. pBuddy simply introduces a Sender to a Buddy who is already heading the same way — the journey is always theirs.',
    bullets: [
      'Buddies choose their own journeys, times and routes.',
      "They pick which parcels they're happy to carry.",
      'pBuddy introduces a Sender to a Buddy already heading the same way.',
    ],
  },
];
