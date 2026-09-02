import type {
  Analysis,
  Analytics,
  DashboardSummary,
  DemoSimulation,
  Explanation,
  LiveMonitor,
  NetworkGraph,
  RecommendedAction,
  RiskLevel,
  RiskSignal,
} from './types';

const DATA_TIMESTAMP = '2026-08-31T12:00:00Z';
const REQUEST_ID = 'req_hosted_seed_2026';
const DATASET_ID = 'jaaldrishti-seed-2026-hosted';

const enhancedVerification: RecommendedAction = {
  code: 'ENHANCED_VERIFICATION',
  label: 'Enhanced verification required',
  rationale: 'Validate shared-entity ownership and dealer evidence before a lending decision.',
  human_review_required: true,
};

const standardProcessing: RecommendedAction = {
  code: 'STANDARD_PROCESSING',
  label: 'Proceed with standard checks',
  rationale: 'No material ecosystem concentration is present in the bounded snapshot.',
  human_review_required: false,
};

export async function handleHostedApi(request: Request) {
  const url = new URL(request.url);
  const route = decodeURIComponent(url.pathname.replace(/^\/api\/v1\/?/, ''));
  if (request.method === 'GET') return handleGet(route, url);
  if (request.method === 'POST') return handlePost(route, request);
  return errorResponse('METHOD_NOT_ALLOWED', 'This operation is not supported.', 405);
}

function handleGet(route: string, url: URL) {
  if (route === 'dashboard/summary') return jsonResponse(dashboardSummary());
  if (route === 'monitor/activity') {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    if (!Number.isInteger(limit) || limit < 5 || limit > 100) {
      return errorResponse('VALIDATION_ERROR', 'Activity limit must be between 5 and 100.', 422);
    }
    return jsonResponse(liveMonitor(limit));
  }
  if (route === 'analytics') return analyticsResponse(url);
  if (route.startsWith('network/')) {
    const customerId = route.slice('network/'.length);
    if (!isCustomerId(customerId)) return errorResponse('CUSTOMER_NOT_FOUND', 'No customer exists for the supplied identifier.', 404);
    return jsonResponse(networkFor(customerId));
  }
  if (route.startsWith('explanation/')) {
    const applicationId = route.slice('explanation/'.length);
    if (!isApplicationId(applicationId)) return errorResponse('APPLICATION_NOT_FOUND', 'No application exists for the supplied identifier.', 404);
    return jsonResponse(explanationFor(applicationId));
  }
  if (route.startsWith('risk_score/')) {
    const applicationId = route.slice('risk_score/'.length);
    if (!isApplicationId(applicationId)) return errorResponse('APPLICATION_NOT_FOUND', 'No application exists for the supplied identifier.', 404);
    return jsonResponse(analysisFor(applicationId));
  }
  return errorResponse('ROUTE_NOT_FOUND', 'The requested API route does not exist.', 404);
}

async function handlePost(route: string, request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (route === 'analyse') {
    const applicationId = typeof body?.application_id === 'string' ? body.application_id : '';
    if (!isApplicationId(applicationId)) return errorResponse('APPLICATION_NOT_FOUND', 'No application exists for the supplied identifier.', 404);
    return jsonResponse(analysisFor(applicationId));
  }
  if (route === 'demo/simulate') {
    const seed = typeof body?.seed === 'number' ? body.seed : 2026;
    return jsonResponse(simulationFor(seed), 201);
  }
  if (route === 'generate_demo_data') {
    return jsonResponse({
      dataset_id: DATASET_ID,
      seed: 2026,
      counts: { customers: 5588, applications: 5588, suspicious_ecosystems: 100 },
      generated_at: DATA_TIMESTAMP,
      generator_version: '1.0.0',
      request_id: REQUEST_ID,
    }, 201);
  }
  return errorResponse('ROUTE_NOT_FOUND', 'The requested API route does not exist.', 404);
}

function dashboardSummary(): DashboardSummary {
  return {
    total_applications: 5588,
    analysed_applications: 5588,
    detected_networks: 98,
    high_risk_ecosystems: 20,
    potential_exposure: 111700000,
    currency: 'INR',
    data_timestamp: DATA_TIMESTAMP,
    request_id: REQUEST_ID,
  };
}

function liveMonitor(limit: number): LiveMonitor {
  const events = Array.from({ length: Math.min(limit, 20) }, (_, index) => {
    const serial = 5442 - index;
    const high = index % 4 !== 3;
    const relationship = !high && index % 2 === 1;
    return {
      timestamp: new Date(Date.UTC(2026, 7, 29, 13, 6) - index * 27 * 60_000).toISOString(),
      application_id: `APP-S-${String(serial).padStart(6, '0')}`,
      customer_id: `CUS-S-${String(serial).padStart(6, '0')}`,
      dealer_id: `DLR-${String(194 - (index % 5)).padStart(4, '0')}`,
      device_id: `DEV-${String(5201 - index).padStart(7, '0')}`,
      account_id: `ACC-${String(5221 - Math.floor(index / 2)).padStart(7, '0')}`,
      loan_amount_inr: 72000 + (index % 7) * 13000,
      risk_score: high ? 72 + (index % 6) * 2.1 : relationship ? 48 : 24,
      risk_level: high ? 'HIGH' as const : relationship ? 'MEDIUM' as const : 'LOW' as const,
      status: high ? 'Requires Review' as const : relationship ? 'Relationship Found' as const : 'Analysed' as const,
      primary_signal: high ? (index % 2 ? 'SHARED_ACCOUNT_MANY_APPLICANTS' : 'RAPID_DEALER_APPLICATION_BURST') : relationship ? 'DEALER_CONCENTRATION' : null,
    };
  });
  return {
    dataset_id: DATASET_ID,
    events,
    focus_customer_id: events.find((event) => event.risk_level === 'HIGH')?.customer_id ?? events[0].customer_id,
    data_timestamp: DATA_TIMESTAMP,
    request_id: REQUEST_ID,
  };
}

function analyticsResponse(url: URL) {
  const analytics = portfolioAnalytics();
  const from = url.searchParams.get('from') ?? analytics.from_date;
  const to = url.searchParams.get('to') ?? analytics.to_date;
  if (from > to) return errorResponse('INVALID_DATE_RANGE', 'The start date must be before the end date.', 400);
  return jsonResponse({
    ...analytics,
    from_date: from,
    to_date: to,
    daily_activity: analytics.daily_activity.filter((item) => item.date >= from && item.date <= to),
  });
}

function portfolioAnalytics(): Analytics {
  const dealerSeed = [
    ['DLR-0181', 35, 35, 9626000],
    ['DLR-0189', 35, 35, 5996000],
    ['DLR-0182', 32, 32, 6793000],
    ['DLR-0184', 30, 30, 4962000],
    ['DLR-0185', 30, 30, 5838000],
    ['DLR-0194', 30, 30, 4378000],
    ['DLR-0197', 30, 30, 7509000],
    ['DLR-0192', 29, 29, 5530000],
    ['DLR-0200', 29, 29, 6522000],
    ['DLR-0193', 28, 28, 4247000],
  ] as const;
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10);
    const applicationCount = 6 + ((index * 7) % 19);
    return { date, application_count: applicationCount, high_risk_count: Math.max(1, Math.round(applicationCount * (0.28 + (index % 4) * 0.08))) };
  });
  return {
    from_date: '2026-08-01',
    to_date: '2026-08-30',
    risk_distribution: [
      { risk_level: 'LOW', count: 5049 },
      { risk_level: 'MEDIUM', count: 51 },
      { risk_level: 'HIGH', count: 488 },
    ],
    top_dealer_clusters: dealerSeed.map(([dealer_id, application_count, high_risk_count, total_exposure_inr]) => ({ dealer_id, application_count, high_risk_count, total_exposure_inr })),
    daily_activity: daily,
    request_id: REQUEST_ID,
  };
}

function networkFor(customerId: string): NetworkGraph {
  const suffix = customerId.split('-').at(-1) ?? '005001';
  const demoCase = hostedCaseFor(customerId.replace(/^CUS-/, 'APP-'));
  const deviceId = `DEV-${suffix.padStart(7, '0')}`;
  const accountId = `ACC-${suffix.padStart(7, '0')}`;
  const dealerId = demoCase.dealerId;
  const locationId = `LOC-${String(1 + (Number(suffix) % 8)).padStart(3, '0')}`;
  const related = Array.from(
    { length: demoCase.linkedApplicants },
    (_, index) => `CUS-S-${String(Number(suffix) + 100 + index).padStart(6, '0')}`,
  );
  const includesDevice = demoCase.kind === 'shared_device' || demoCase.kind === 'mixed_ring';
  const includesAccount = demoCase.kind === 'shared_account' || demoCase.kind === 'mixed_ring';
  const nodes: NetworkGraph['nodes'] = [
    { id: customerId, type: 'customer', label: `Customer ${suffix}`, risk_level: demoCase.riskLevel, is_focus: true },
    ...(includesDevice ? [{ id: deviceId, type: 'device' as const, label: `Shared device ${suffix}`, risk_level: null, is_focus: false }] : []),
    ...(includesAccount ? [{ id: accountId, type: 'account' as const, label: `Shared account ${suffix}`, risk_level: null, is_focus: false }] : []),
    { id: dealerId, type: 'dealer', label: `Dealer ${dealerId.slice(-4)}`, risk_level: null, is_focus: false },
    { id: locationId, type: 'location', label: `Location ${locationId.slice(-3)}`, risk_level: null, is_focus: false },
    ...related.map((id, index) => ({ id, type: 'customer' as const, label: `Connected customer ${index + 1}`, risk_level: index < Math.ceil(related.length / 2) ? 'HIGH' as const : 'MEDIUM' as const, is_focus: false })),
  ];
  const observed = '2026-08-29T10:00:00Z';
  const edge = (id: string, source: string, target: string, type: string, strength = 1): NetworkGraph['edges'][number] => ({ id, source, target, type, strength, first_seen: observed, last_seen: DATA_TIMESTAMP });
  const edges: NetworkGraph['edges'] = [
    edge(`focus-dealer-${suffix}`, customerId, dealerId, 'applied_via', 0.7),
    edge(`focus-location-${suffix}`, customerId, locationId, 'located_in', 0.2),
    ...(includesDevice ? [edge(`focus-device-${suffix}`, customerId, deviceId, 'uses_device')] : []),
    ...(includesAccount ? [edge(`focus-account-${suffix}`, customerId, accountId, 'linked_account')] : []),
    ...related.flatMap((id, index) => [
      ...(includesDevice ? [edge(`device-${index}-${suffix}`, id, deviceId, 'uses_device')] : []),
      ...(includesAccount ? [edge(`account-${index}-${suffix}`, id, accountId, 'linked_account')] : []),
      edge(`dealer-${index}-${suffix}`, id, dealerId, 'applied_via', 0.7),
    ]),
  ];
  const possibleEdges = Math.max(1, (nodes.length * (nodes.length - 1)) / 2);
  return {
    customer_id: customerId,
    as_of: DATA_TIMESTAMP,
    summary: { node_count: nodes.length, edge_count: edges.length, linked_applicant_count: related.length, component_density: Number((edges.length / possibleEdges).toFixed(2)), community_id: `community-${suffix}`, truncated: false },
    nodes,
    edges,
    request_id: REQUEST_ID,
  };
}

function sharedDeviceSignal(): RiskSignal {
  return {
    code: 'SHARED_DEVICE_MANY_APPLICANTS',
    category: 'IDENTITY',
    severity: 'HIGH',
    message: 'One device is linked to 8 applicants in the current ecosystem.',
    entity_ids: ['DEV-0004945'],
    observed_value: 8,
    threshold: 3,
    points: 30,
    score_floor: 72,
    window: null,
  };
}

function sharedAccountSignal(): RiskSignal {
  return {
    code: 'SHARED_ACCOUNT_MANY_APPLICANTS',
    category: 'IDENTITY',
    severity: 'HIGH',
    message: 'One repayment account is linked to 8 applicants in the current ecosystem.',
    entity_ids: ['ACC-0004962'],
    observed_value: 8,
    threshold: 3,
    points: 28,
    score_floor: 70,
    window: null,
  };
}

function rapidDealerSignal(): RiskSignal {
  return {
    code: 'RAPID_DEALER_APPLICATION_BURST',
    category: 'TEMPORAL',
    severity: 'HIGH',
    message: 'Five connected applications arrived through one dealer inside two hours.',
    entity_ids: ['DLR-0183'],
    observed_value: 5,
    threshold: 4,
    points: 24,
    score_floor: 70,
    window: '2h',
  };
}

function highVelocitySignal(): RiskSignal {
  return {
    code: 'HIGH_APPLICATION_VELOCITY',
    category: 'TEMPORAL',
    severity: 'HIGH',
    message: 'The connected ecosystem accumulated applications faster than the review threshold.',
    entity_ids: [],
    observed_value: 5,
    threshold: 4,
    points: 18,
    score_floor: 0,
    window: '2h',
  };
}

function multipleIdentitySignal(): RiskSignal {
  return {
    code: 'MULTIPLE_SHARED_IDENTITY_SIGNALS',
    category: 'IDENTITY',
    severity: 'HIGH',
    message: 'Device and repayment-account reuse overlap inside the same applicant ring.',
    entity_ids: ['DEV-0004959', 'ACC-0004968'],
    observed_value: 2,
    threshold: 2,
    points: 20,
    score_floor: 72,
    window: null,
  };
}

type HostedCaseKind = 'shared_device' | 'shared_account' | 'dealer_burst' | 'mixed_ring' | 'clean';

interface HostedCase {
  kind: HostedCaseKind;
  riskScore: number;
  riskLevel: RiskLevel;
  signals: RiskSignal[];
  linkedApplicants: number;
  clusterSize: number;
  velocity: number;
  dealerId: string;
}

function hostedCaseFor(applicationId: string): HostedCase {
  if (applicationId.startsWith('APP-N-')) {
    return { kind: 'clean', riskScore: 0.9, riskLevel: 'LOW', signals: [], linkedApplicants: 0, clusterSize: 1, velocity: 1, dealerId: 'DLR-0049' };
  }
  if (applicationId === 'APP-S-005013') {
    return { kind: 'shared_account', riskScore: 80.65, riskLevel: 'HIGH', signals: [sharedAccountSignal(), rapidDealerSignal(), highVelocitySignal()], linkedApplicants: 7, clusterSize: 11, velocity: 6, dealerId: 'DLR-0182' };
  }
  if (applicationId === 'APP-S-005021') {
    return { kind: 'dealer_burst', riskScore: 70, riskLevel: 'HIGH', signals: [rapidDealerSignal(), highVelocitySignal()], linkedApplicants: 4, clusterSize: 7, velocity: 5, dealerId: 'DLR-0183' };
  }
  if (applicationId === 'APP-S-005024') {
    return { kind: 'mixed_ring', riskScore: 86.55, riskLevel: 'HIGH', signals: [sharedDeviceSignal(), sharedAccountSignal(), multipleIdentitySignal()], linkedApplicants: 3, clusterSize: 8, velocity: 4, dealerId: 'DLR-0184' };
  }
  return { kind: 'shared_device', riskScore: 72, riskLevel: 'HIGH', signals: [sharedDeviceSignal()], linkedApplicants: 7, clusterSize: 11, velocity: 6, dealerId: 'DLR-0181' };
}

function analysisFor(applicationId: string): Analysis {
  const demoCase = hostedCaseFor(applicationId);
  const high = demoCase.riskLevel === 'HIGH';
  const customerId = applicationId.replace(/^APP-/, 'CUS-');
  return {
    analysis_id: `analysis_hosted_${applicationId.toLowerCase()}`,
    application_id: applicationId,
    customer_id: customerId,
    risk_score: demoCase.riskScore,
    risk_level: demoCase.riskLevel,
    signals: demoCase.signals,
    recommended_action: high ? enhancedVerification : standardProcessing,
    score_components: { rule_score: high ? Math.min(100, demoCase.signals.reduce((total, signal) => total + signal.points, 0)) : 0, graph_score: high ? 54.4 : 4, temporal_score: high ? Math.min(100, demoCase.velocity * 12) : 2, ml_score: high ? 91 : 8, weights: { rule: 0.4, graph: 0.2, temporal: 0.15, ml: 0.25 }, weighted_score: high ? Math.max(52, demoCase.riskScore - 12) : 0.9, enforced_floor: high ? Math.max(...demoCase.signals.map((signal) => signal.score_floor)) : 0, final_score: demoCase.riskScore },
    versions: { feature_schema: '1.0.0', temporal_feature_schema: '1.0.0', risk_policy: '1.0.0', model: 'xgboost:1.0.0' },
    analysed_at: DATA_TIMESTAMP,
    request_id: REQUEST_ID,
  };
}

function explanationFor(applicationId: string): Explanation {
  const analysis = analysisFor(applicationId);
  const demoCase = hostedCaseFor(applicationId);
  const identitySignals = analysis.signals.filter((signal) => signal.category === 'IDENTITY').length;
  const temporalSignals = analysis.signals.filter((signal) => signal.category === 'TEMPORAL');
  return {
    application_id: applicationId,
    customer_id: analysis.customer_id,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    borrower: { application_id: applicationId, customer_id: analysis.customer_id, age: 28, annual_income_inr: 194000, credit_score: 724, location_id: 'LOC-006', loan_amount_inr: 319000, loan_type: 'three_wheeler', dealer_id: demoCase.dealerId },
    signals: analysis.signals,
    graph_evidence: { connected_applicant_count: demoCase.linkedApplicants, cluster_size: demoCase.clusterSize, network_density: analysis.risk_level === 'HIGH' ? 0.61 : 0, community_id: `community-${analysis.customer_id.slice(-6)}`, shared_identity_signal_count: identitySignals, max_connection_strength: analysis.risk_level === 'HIGH' ? 0.7 : 0 },
    temporal_evidence: { as_of: DATA_TIMESTAMP, application_velocity_2h: demoCase.velocity, linked_applicants_24h: demoCase.linkedApplicants, network_growth_rate_24h: analysis.risk_level === 'HIGH' ? 2.4 : 0, recency_score: analysis.risk_level === 'HIGH' ? 0.92 : 0.08, rapid_burst_detected: temporalSignals.length > 0, burst_signal_types: temporalSignals.map((signal) => signal.window ?? signal.code.toLowerCase()) },
    recommended_action: analysis.recommended_action,
    versions: analysis.versions,
    analysed_at: analysis.analysed_at,
    request_id: REQUEST_ID,
  };
}

function simulationFor(seed: number): DemoSimulation {
  const signal = sharedDeviceSignal();
  const applicants = Array.from({ length: 6 }, (_, index) => ({ id: `CUS-S-${String(index + 1).padStart(6, '0')}`, type: 'customer', label: index === 0 ? 'Customer A' : `Customer ${index + 1}`, role: index === 0 ? 'focus_customer' : 'applicant', is_focus: index === 0 }));
  const entities = [
    ...applicants,
    { id: 'DEV-0000002', type: 'device', label: 'Shared device', role: 'shared_device', is_focus: false },
    { id: 'DLR-0011', type: 'dealer', label: 'Dealer 0011', role: 'dealer', is_focus: false },
  ];
  const edges = applicants.flatMap((applicant, index) => [
    { id: `device-${index}`, source: applicant.id, target: 'DEV-0000002', type: 'uses_device' },
    { id: `dealer-${index}`, source: applicant.id, target: 'DLR-0011', type: 'applied_via' },
  ]);
  return {
    scenario_id: `SIM-${seed}-hosted`,
    seed,
    customer_label: 'Customer A',
    application_id: 'APP-S-000007',
    customer_id: applicants[0].id,
    before: { risk_score: 0, risk_level: 'LOW', linked_applicant_count: 0, cluster_size: 1, shared_device_applicant_count: 1, application_velocity_2h: 1, dealer_applications_2h: 1, signals: [], recommended_action: standardProcessing },
    after: { risk_score: 85.43, risk_level: 'HIGH', linked_applicant_count: 5, cluster_size: 6, shared_device_applicant_count: 6, application_velocity_2h: 6, dealer_applications_2h: 6, signals: [signal], recommended_action: enhancedVerification },
    created_entities: applicants.slice(1),
    created_edges: edges,
    network: { nodes: entities, edges, summary: { applicant_count: 6, shared_device_id: 'DEV-0000002', dealer_id: 'DLR-0011' } },
    explanations: [signal],
    recommended_action: enhancedVerification,
    generated_at: DATA_TIMESTAMP,
    request_id: REQUEST_ID,
  };
}

function isApplicationId(value: string) {
  return /^APP-[SN]-\d{6}$/.test(value);
}

function isCustomerId(value: string) {
  return /^CUS-[SN]-\d{6}$/.test(value);
}

function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message, request_id: REQUEST_ID } }, status);
}
