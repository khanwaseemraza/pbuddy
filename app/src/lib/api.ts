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

export const api = {
  get: <T>(path: string, token: string) => request<T>(path, token),
  post: <T>(path: string, token: string, data?: unknown) =>
    request<T>(path, token, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
};

export interface Corridor {
  id: string;
  origin_city: string;
  dest_city: string;
  display_name: string;
}
