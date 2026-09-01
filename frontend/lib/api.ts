import type { Analytics, DashboardSummary } from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      payload?.error?.message ?? 'The intelligence service is unavailable.',
      payload?.error?.code ?? 'API_UNAVAILABLE',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function getDashboardSummary(signal?: AbortSignal) {
  return getJson<DashboardSummary>('/api/v1/dashboard/summary', signal);
}

export function getAnalytics(signal?: AbortSignal) {
  return getJson<Analytics>('/api/v1/analytics', signal);
}
