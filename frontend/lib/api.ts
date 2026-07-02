/**
 * Thin API client for the SecureBank backend.
 *
 * Security notes:
 *  - We NEVER store the JWT in localStorage. It lives in an httpOnly cookie set
 *    by the server, so it is invisible to JavaScript (XSS-resistant). We simply
 *    send `credentials: 'include'` so the browser attaches it automatically.
 *  - For state-changing requests we read the readable `csrfToken` cookie and
 *    echo it in the `X-CSRF-Token` header (double-submit-cookie CSRF defense).
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Ensure we hold a CSRF token cookie before a state-changing request. */
export async function ensureCsrf(): Promise<void> {
  if (readCookie('csrfToken')) return;
  await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
}

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiGet<T = any>(path: string): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function stateChanging<T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  await ensureCsrf();
  const csrf = readCookie('csrfToken');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function apiPost<T = any>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return stateChanging<T>('POST', path, body);
}

export function apiPatch<T = any>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return stateChanging<T>('PATCH', path, body);
}
