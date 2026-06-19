// Cookie / analytics consent banner (E16-S3). Web-only, privacy-first: shows
// once until the user chooses, defaults nothing non-essential on. Declining keeps
// only essential storage (sign-in). No emoji — premium brand.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { getConsent, setConsent, type ConsentChoice } from '../lib/consent';
import { theme } from '../theme';

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && getConsent() === null) setShow(true);
  }, []);

  if (!show) return null;

  function choose(choice: ConsentChoice) {
    setConsent(choice);
    setShow(false);
  }

  return (
    <View
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.cardSolid, borderTopWidth: 1, borderColor: theme.border,
        padding: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'center', gap: 12,
      }}
    >
      <Text style={{ color: theme.text, flex: 1, minWidth: 240, fontSize: 13, lineHeight: 19 }}>
        We use essential cookies to keep you signed in. With your consent we’d also use
        analytics cookies to improve PBuddy. See our{' '}
        <Link href="/legal/privacy" style={{ color: theme.accent, fontWeight: '700' }}>Privacy Policy</Link>.
      </Text>
      <Pressable
        onPress={() => choose('essential')}
        style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}
      >
        <Text style={{ color: theme.text, fontWeight: '700' }}>Essential only</Text>
      </Pressable>
      <Pressable
        onPress={() => choose('all')}
        style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.accent }}
      >
        <Text style={{ color: theme.accentText, fontWeight: '800' }}>Accept all</Text>
      </Pressable>
    </View>
  );
}
