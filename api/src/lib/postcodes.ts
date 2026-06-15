// UK postcode validation + geocoding via postcodes.io (free, no key). This is
// how the domestic-only rule is enforced at the address level: both pickup and
// dropoff must resolve to a real GB postcode, and we capture lat/lng for maps
// and matching proximity.
import { config } from '../config.ts';

// GB nations recognised as domestic. postcodes.io returns these in `country`.
const GB_COUNTRIES = new Set([
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
]);

// Loose structural check (full validation is delegated to postcodes.io). Useful
// for fast unit-testable rejection of obvious garbage without a network call.
const UK_POSTCODE_RE =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function isValidPostcodeFormat(input: string): boolean {
  return UK_POSTCODE_RE.test(input.trim());
}

/** Normalise to canonical upper-case, single-spaced form (e.g. "m1 1ae" -> "M1 1AE"). */
export function normalisePostcode(input: string): string {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export interface PostcodeLookup {
  valid: boolean;
  reason?: 'bad_format' | 'not_found' | 'not_gb';
  postcode?: string;
  lat?: number;
  lng?: number;
  country?: string;
}

/**
 * Validate + geocode a UK postcode. Returns valid=false (never throws) for bad
 * format, unknown postcode, or a non-GB result. Network errors do throw.
 */
export async function lookupPostcode(input: string): Promise<PostcodeLookup> {
  if (!isValidPostcodeFormat(input)) {
    return { valid: false, reason: 'bad_format' };
  }
  const url = `${config.postcodesIoBase}/postcodes/${encodeURIComponent(input.trim())}`;
  const res = await fetch(url);
  if (res.status === 404) {
    return { valid: false, reason: 'not_found' };
  }
  if (!res.ok) {
    throw new Error(`postcodes_io_error:${res.status}`);
  }
  const body = (await res.json()) as {
    result?: { postcode: string; latitude: number; longitude: number; country: string };
  };
  const r = body.result;
  if (!r) return { valid: false, reason: 'not_found' };
  if (!GB_COUNTRIES.has(r.country)) {
    return { valid: false, reason: 'not_gb', country: r.country };
  }
  return {
    valid: true,
    postcode: r.postcode,
    lat: r.latitude,
    lng: r.longitude,
    country: r.country,
  };
}
