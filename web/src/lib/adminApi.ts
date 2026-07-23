import { apiUrl } from '@/lib/api';

export function getCsrfToken(): string {
  const cookies = document.cookie.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const eq = cookie.indexOf('=');
    if (eq < 0) continue;
    const name = cookie.slice(0, eq);
    const value = decodeURIComponent(cookie.slice(eq + 1));
    if (name.endsWith('_csrf')) return value;
  }
  return '';
}

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminFetch<T>(path: string, init: RequestInit = {}, csrf = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type') && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  if (csrf) {
    const token = getCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
  }
  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(detail) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep raw
    }
    throw new AdminApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadFile(file: File, folder = 'projects'): Promise<string> {
  const ticket = await adminFetch<{ uploadUrl: string; publicUrl: string }>(
    '/api/admin/media/upload-url',
    { method: 'POST', body: JSON.stringify({ fileName: file.name, folder }) },
    true,
  );
  let uploadUrl = ticket.uploadUrl;
  if (uploadUrl.startsWith('http')) {
    try {
      const parsed = new URL(uploadUrl);
      uploadUrl = `${parsed.pathname}${parsed.search}`;
    } catch {
      // keep absolute
    }
  }
  const put = await fetch(uploadUrl.startsWith('http') ? uploadUrl : apiUrl(uploadUrl), {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!put.ok) {
    throw new AdminApiError(put.status, await put.text());
  }
  const result = (await put.json()) as { publicUrl?: string };
  return result.publicUrl || ticket.publicUrl;
}
