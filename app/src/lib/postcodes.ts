// Client-side UK postcode validation + geocoding via postcodes.io (free, no key).
// The API validates again server-side; this gives the sender instant feedback and
// a map pin while filling the form.
const BASE = 'https://api.postcodes.io';
const GB = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland']);
const UK_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export interface ResolvedAddress {
  valid: boolean;
  reason?: 'bad_format' | 'not_found' | 'not_gb';
  postcode?: string;
  lat?: number;
  lng?: number;
  country?: string;
}

export function isValidFormat(input: string): boolean {
  return UK_RE.test(input.trim());
}

export async function lookupPostcode(input: string): Promise<ResolvedAddress> {
  if (!isValidFormat(input)) return { valid: false, reason: 'bad_format' };
  const res = await fetch(`${BASE}/postcodes/${encodeURIComponent(input.trim())}`);
  if (res.status === 404) return { valid: false, reason: 'not_found' };
  if (!res.ok) throw new Error(`postcodes_io_${res.status}`);
  const body = (await res.json()) as {
    result?: { postcode: string; latitude: number; longitude: number; country: string };
  };
  const r = body.result;
  if (!r) return { valid: false, reason: 'not_found' };
  if (!GB.has(r.country)) return { valid: false, reason: 'not_gb', country: r.country };
  return { valid: true, postcode: r.postcode, lat: r.latitude, lng: r.longitude, country: r.country };
}
