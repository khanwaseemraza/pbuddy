// AddressPicker: postcode -> validate/geocode (GB only) -> confirm street line ->
// pin on a free OSM map. Emits the resolved address up to the parent form.
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { lookupPostcode, type ResolvedAddress } from '../lib/postcodes';
import { MapPin } from './MapPin';
import { theme } from '../theme';

export interface PickedAddress {
  postcode: string;
  address_line: string;
  lat: number;
  lng: number;
}

const REASONS: Record<string, string> = {
  bad_format: 'That doesn’t look like a UK postcode.',
  not_found: 'Postcode not found.',
  not_gb: 'PBuddy is UK-only — that postcode isn’t in Great Britain.',
};

export function AddressPicker({
  label,
  onChange,
}: {
  label: string;
  onChange: (a: PickedAddress | null) => void;
}) {
  const [postcode, setPostcode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [resolved, setResolved] = useState<ResolvedAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLookup() {
    setBusy(true);
    setError(null);
    setResolved(null);
    onChange(null);
    try {
      const r = await lookupPostcode(postcode);
      if (!r.valid) {
        setError(REASONS[r.reason ?? 'not_found']);
        return;
      }
      setResolved(r);
      emit(r, addressLine);
    } catch {
      setError('Could not check that postcode — try again.');
    } finally {
      setBusy(false);
    }
  }

  function emit(r: ResolvedAddress, line: string) {
    if (r.valid && line.trim()) {
      onChange({ postcode: r.postcode!, address_line: line.trim(), lat: r.lat!, lng: r.lng! });
    } else {
      onChange(null);
    }
  }

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={postcode}
          onChangeText={setPostcode}
          placeholder="e.g. M1 1AE"
          autoCapitalize="characters"
          placeholderTextColor={theme.muted}
          style={inputStyle({ flex: 1 })}
        />
        <Pressable onPress={onLookup} disabled={busy} style={lookupBtn(busy)}>
          {busy ? <ActivityIndicator color={theme.accentText} /> : <Text style={{ color: theme.accentText, fontWeight: '800' }}>Find</Text>}
        </Pressable>
      </View>

      {error ? <Text style={{ color: theme.danger, marginTop: 8 }}>{error}</Text> : null}

      {resolved?.valid ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: theme.muted, marginBottom: 8 }}>{resolved.postcode} · {resolved.country}</Text>
          <TextInput
            value={addressLine}
            onChangeText={(t) => {
              setAddressLine(t);
              emit(resolved, t);
            }}
            placeholder="Street address (house/flat, street)"
            placeholderTextColor={theme.muted}
            style={inputStyle({ marginBottom: 12 })}
          />
          <MapPin lat={resolved.lat!} lng={resolved.lng!} />
        </View>
      ) : null}
    </View>
  );
}

function inputStyle(extra: object) {
  return {
    backgroundColor: theme.card,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    ...extra,
  };
}

function lookupBtn(busy: boolean) {
  return {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    opacity: busy ? 0.6 : 1,
  };
}
