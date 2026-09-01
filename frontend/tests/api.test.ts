import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  analyseApplication,
  ApiError,
  getDashboardSummary,
  getNetwork,
} from '../lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API client', () => {
  it('returns typed dashboard data from the configured backend', async () => {
    const payload = {
      total_applications: 5588,
      analysed_applications: 1,
      detected_networks: 101,
      high_risk_ecosystems: 88,
      potential_exposure: 111700000,
      currency: 'INR',
      data_timestamp: '2026-08-31T12:00:00Z',
      request_id: 'req_test',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDashboardSummary()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/v1/dashboard/summary',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('preserves stable backend error codes without exposing transport details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'APPLICATION_NOT_FOUND',
              message: 'No application exists for the supplied identifier.',
            },
          }),
          { status: 404 },
        ),
      ),
    );

    const error = await analyseApplication('APP-UNKNOWN').catch((reason) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'APPLICATION_NOT_FOUND', status: 404 });
  });

  it('encodes graph identifiers and bounded traversal options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getNetwork('CUS:SPECIAL', { depth: 3, maxNodes: 25 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8000/api/v1/network/CUS%3ASPECIAL?depth=3&max_nodes=25',
    );
  });
});
