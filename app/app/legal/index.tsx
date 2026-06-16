// Public legal hub. Lists the current legal documents; each opens a reader.
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { api, LEGAL_TITLES, type LegalDoc } from '../../src/lib/api';
import { GlassCard } from '../../src/components/GlassCard';
import { theme } from '../../src/theme';

export default function LegalIndex() {
  const [docs, setDocs] = useState<Pick<LegalDoc, 'key' | 'version'>[] | null>(null);

  useEffect(() => {
    api
      .getPublic<{ documents: Pick<LegalDoc, 'key' | 'version'>[] }>('/legal')
      .then((d) => setDocs(d.documents))
      .catch(() => setDocs([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 }}>
      <Text style={{ color: theme.accent, fontSize: 26, fontWeight: '800', marginBottom: 20 }}>Legal</Text>
      {!docs ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.key}
          renderItem={({ item }) => (
            <Link href={`/legal/${item.key}` as Href} asChild>
              <Pressable>
                <GlassCard style={{ marginBottom: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
                    {LEGAL_TITLES[item.key] ?? item.key}
                  </Text>
                </GlassCard>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
