import type {
  Analysis,
  Analytics,
  DashboardSummary,
  DemoSimulation,
  Explanation,
  LiveMonitor,
  NetworkGraph,
} from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');

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

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'API_UNAVAILABLE',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function getDashboardSummary(signal?: AbortSignal) {
  return getJson<DashboardSummary>('/api/v1/dashboard/summary', signal);
}

export function getLiveMonitor(limit = 20, signal?: AbortSignal) {
  return getJson<LiveMonitor>(`/api/v1/monitor/activity?limit=${limit}`, signal);
}

export function getAnalytics(
  filters?: { from?: string; to?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (filters?.from) query.set('from', filters.from);
  if (filters?.to) query.set('to', filters.to);
  const suffix = query.size ? `?${query.toString()}` : '';
  return getJson<Analytics>(`/api/v1/analytics${suffix}`, signal);
}

export function analyseApplication(
  applicationId: string,
  forceRefresh = false,
  signal?: AbortSignal,
) {
  return postJson<Analysis>(
    '/api/v1/analyse',
    { application_id: applicationId, force_refresh: forceRefresh },
    signal,
  );
}

export function getExplanation(applicationId: string, signal?: AbortSignal) {
  return getJson<Explanation>(
    `/api/v1/explanation/${encodeURIComponent(applicationId)}`,
    signal,
  );
}

export function getNetwork(
  customerId: string,
  options: { depth?: number; maxNodes?: number } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    depth: String(options.depth ?? 2),
    max_nodes: String(options.maxNodes ?? 150),
  });
  return getJson<NetworkGraph>(
    `/api/v1/network/${encodeURIComponent(customerId)}?${query.toString()}`,
    signal,
  );
}

export function simulateEmergingRisk(seed = 2026, signal?: AbortSignal) {
  return postJson<DemoSimulation>('/api/v1/demo/simulate', { seed }, signal);
}
