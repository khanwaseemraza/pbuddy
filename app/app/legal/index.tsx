// Public legal hub. Lists the current legal documents; each opens a reader.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { api, LEGAL_TITLES, type LegalDoc } from '../../src/lib/api';
import { FA, Glass, PageScreen, Skeleton } from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

export default function LegalIndex() {
  const router = useRouter();
  const [docs, setDocs] = useState<Pick<LegalDoc, 'key' | 'version'>[] | null>(null);

  useEffect(() => {
    api
      .getPublic<{ documents: Pick<LegalDoc, 'key' | 'version'>[] }>('/legal')
      .then((d) => setDocs(d.documents))
      .catch(() => setDocs([]));
  }, []);

  return (
    <PageScreen onBack={() => router.back()} title="Legal" subtitle="The documents that govern using pBuddy.">
      {!docs ? (
        <><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></>
      ) : (
        docs.map((item) => (
          <Pressable key={item.key} onPress={() => router.push(`/legal/${item.key}` as Href)}>
            <Glass style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.heading, fontSize: 16, fontWeight: '700' }}>{LEGAL_TITLES[item.key] ?? item.key}</Text>
              <FA name="chevron-right" size={13} color={C.muted2} />
            </Glass>
          </Pressable>
        ))
      )}
    </PageScreen>
  );
}
