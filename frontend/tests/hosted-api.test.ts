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

  it('serves distinct investigation and network casebook scenarios', async () => {
    const dealerResponse = await handleHostedApi(
      new Request('https://demo.example/api/v1/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: 'APP-S-005021' }),
      }),
    );
    const cleanNetworkResponse = await handleHostedApi(
      new Request('https://demo.example/api/v1/network/CUS-N-000031?depth=2&max_nodes=150'),
    );

    expect(dealerResponse.status).toBe(200);
    const dealerPayload = await dealerResponse.json();
    expect(dealerPayload).toMatchObject({
      risk_score: 70,
      risk_level: 'HIGH',
    });
    expect(dealerPayload.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RAPID_DEALER_APPLICATION_BURST' }),
    ]));
    expect(cleanNetworkResponse.status).toBe(200);
    const cleanNetworkPayload = await cleanNetworkResponse.json();
    expect(cleanNetworkPayload).toMatchObject({
      customer_id: 'CUS-N-000031',
      summary: { linked_applicant_count: 0 },
    });
    expect(cleanNetworkPayload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'CUS-N-000031', risk_level: 'LOW' }),
    ]));
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
