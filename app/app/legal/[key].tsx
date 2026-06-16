// Public legal document reader. Renders the markdown body as readable text
// (lightweight: headings/bullets styled, no markdown engine needed).
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, LEGAL_TITLES, type LegalDoc } from '../../src/lib/api';
import { theme } from '../../src/theme';

export default function LegalDocScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '800', marginBottom: 16 }}>
        {LEGAL_TITLES[key ?? ''] ?? 'Legal'}
      </Text>
      {error ? (
        <Text style={{ color: theme.danger }}>Could not load this document.</Text>
      ) : !doc ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        doc.body.split('\n').map((line, i) => <Line key={i} text={line} />)
      )}
      {doc ? <Text style={{ color: theme.muted, marginTop: 24 }}>Version {doc.version}</Text> : null}
    </ScrollView>
  );
}

// Minimal markdown line rendering: # / ## headings, - bullets, **bold** intro.
function Line({ text }: { text: string }) {
  if (text.startsWith('## ')) {
    return <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 6 }}>{text.slice(3)}</Text>;
  }
  if (text.startsWith('# ')) {
    return <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>{text.slice(2)}</Text>;
  }
  if (text.startsWith('- ')) {
    return <Text style={{ color: theme.text, fontSize: 15, marginLeft: 8, marginBottom: 4 }}>{`•  ${text.slice(2)}`}</Text>;
  }
  if (text.trim() === '') return <View style={{ height: 8 }} />;
  const bold = text.startsWith('**') && text.includes('**', 2);
  return (
    <Text style={{ color: bold ? theme.text : theme.muted, fontSize: 15, fontWeight: bold ? '700' : '400', marginBottom: 6, lineHeight: 22 }}>
      {text.replace(/\*\*/g, '')}
    </Text>
  );
}
