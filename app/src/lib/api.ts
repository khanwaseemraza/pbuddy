// Thin API client. Every call carries the Firebase ID token; the PBuddy API
// verifies it and scopes the request to the user.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`api_error_${status}`);
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

async function requestPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  get: <T>(path: string, token: string) => request<T>(path, token),
  post: <T>(path: string, token: string, data?: unknown) =>
    request<T>(path, token, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  // Unauthenticated GET — used for the public legal pages.
  getPublic: <T>(path: string) => requestPublic<T>(path),
};

export interface LegalDoc {
  key: string;
  version: number;
  body: string;
}

// Human labels for the legal document keys.
export const LEGAL_TITLES: Record<string, string> = {
  terms: 'Terms of Service',
  carrier_agreement: 'Buddy Carrier Agreement',
  liability_policy: 'Liability Policy',
  insurance_optional: 'Optional Parcel Cover',
  prohibited_items: 'Prohibited Items',
  privacy: 'Privacy Policy',
  'cost_sharing.explainer': 'How cost-sharing works',
  green_claims: 'Green Claims Methodology',
};

export interface Corridor {
  id: string;
  origin_city: string;
  dest_city: string;
  display_name: string;
}

export interface ParcelSummary {
  id: string;
  title: string;
  status: string;
  direction: string;
  corridor: string;
  pickup_postcode: string;
  dropoff_postcode: string;
  pricing_mode: 'fixed' | 'auction';
  max_contribution_pennies: number;
  contribution_amount_pennies: number | null;
  pending_bids: string | number;
}

export interface BidSummary {
  id: string;
  bid_contribution_pennies: number;
  bid_pieces: number;
  status: string;
  traveller_name: string | null;
  trust_score: number;
  rating_count: number;
  transport_mode: string;
  depart_at: string;
}

export interface HandoffCodes {
  pickup_qr: string;
  pickup_otp: string;
  dropoff_qr: string;
  dropoff_otp: string;
}

export const gbp = (pennies: number) => `£${(pennies / 100).toFixed(2)}`;
