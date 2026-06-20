// Public legal document reader. Renders the markdown body as readable text
// (lightweight: headings/bullets styled, no markdown engine needed).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, LEGAL_TITLES, type LegalDoc } from '../../src/lib/api';
import { Glass, PageScreen, Skeleton } from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

export default function LegalDocScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!key) return;
    api
      .getPublic<LegalDoc>(`/legal/${key}`)
      .then(setDoc)
      .catch(() => setError(true));
  }, [key]);

  return (
    <PageScreen onBack={() => router.back()} title={LEGAL_TITLES[key ?? ''] ?? 'Legal'}>
      {error ? (
        <Glass><Text style={{ color: C.coralStatus }}>Could not load this document.</Text></Glass>
      ) : !doc ? (
        <><Skeleton height={28} /><Skeleton height={120} /></>
      ) : (
        <Glass style={{ padding: 24 }}>
          {doc.body.split('\n').map((line, i) => <Line key={i} text={line} />)}
          <Text style={{ color: C.muted2, marginTop: 20, fontSize: 12 }}>Version {doc.version}</Text>
        </Glass>
      )}
    </PageScreen>
  );
}

// Minimal markdown line rendering: # / ## headings, - bullets, **bold** intro.
function Line({ text }: { text: string }) {
  if (text.startsWith('## ')) {
    return <Text style={{ color: C.heading, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 6 }}>{text.slice(3)}</Text>;
  }
  if (text.startsWith('# ')) {
    return <Text style={{ color: C.heading, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>{text.slice(2)}</Text>;
  }
  if (text.startsWith('- ')) {
    return <Text style={{ color: C.heading, fontSize: 15, marginLeft: 8, marginBottom: 4, lineHeight: 22 }}>{`•  ${text.slice(2)}`}</Text>;
  }
  if (text.trim() === '') return <View style={{ height: 8 }} />;
  const bold = text.startsWith('**') && text.includes('**', 2);
  return (
    <Text style={{ color: bold ? C.heading : C.body, fontSize: 15, fontWeight: bold ? '700' : '400', marginBottom: 6, lineHeight: 22 }}>
      {text.replace(/\*\*/g, '')}
    </Text>
  );
}
