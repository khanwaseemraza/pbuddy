// Demo screen for the AddressPicker — enter a UK postcode, confirm the street
// line, and see the pin. The sender/traveller forms (PBD-46/47) reuse this.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { AddressPicker, type PickedAddress } from '../src/components/AddressPicker';
import { GlassCard } from '../src/components/GlassCard';
import { theme } from '../src/theme';

export default function AddressDemo() {
  const [pickup, setPickup] = useState<PickedAddress | null>(null);
  const [dropoff, setDropoff] = useState<PickedAddress | null>(null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '800', marginBottom: 4 }}>Where’s it going?</Text>
      <Text style={{ color: theme.muted, marginBottom: 28 }}>UK postcodes only — both ends must be in Great Britain.</Text>

      <AddressPicker label="Pickup" onChange={setPickup} />
      <AddressPicker label="Dropoff" onChange={setDropoff} />

      <GlassCard style={{ marginTop: 8 }}>
        <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>Resolved</Text>
        <Text style={{ color: pickup ? theme.accent : theme.muted }}>
          Pickup: {pickup ? `${pickup.postcode} — ${pickup.address_line}` : 'not set'}
        </Text>
        <Text style={{ color: dropoff ? theme.accent : theme.muted, marginTop: 4 }}>
          Dropoff: {dropoff ? `${dropoff.postcode} — ${dropoff.address_line}` : 'not set'}
        </Text>
      </GlassCard>
    </ScrollView>
  );
}
