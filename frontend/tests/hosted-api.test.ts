import { describe, expect, it } from 'vitest';

import { handleHostedApi } from '../lib/hosted-api';

describe('hosted demo API', () => {
  it('serves a complete dashboard snapshot without an external backend', async () => {
    const response = await handleHostedApi(
      new Request('https://demo.example/api/v1/dashboard/summary'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total_applications: 5588,
      analysed_applications: 5588,
      currency: 'INR',
    });
  });

  it('validates live-monitor bounds with the standard error envelope', async () => {
    const response = await handleHostedApi(
      new Request('https://demo.example/api/v1/monitor/activity?limit=2'),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('returns a deterministic high-risk simulation for presentation mode', async () => {
    const response = await handleHostedApi(
      new Request('https://demo.example/api/v1/demo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 17 }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      scenario_id: 'SIM-17-hosted',
      seed: 17,
      before: { risk_level: 'LOW' },
      after: { risk_level: 'HIGH' },
    });
  });

  it('rejects unknown applications without leaking transport details', async () => {
    const response = await handleHostedApi(
      new Request('https://demo.example/api/v1/explanation/APP-UNKNOWN'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'APPLICATION_NOT_FOUND' },
    });
  });
});
