'use client';

import '@xyflow/react/dist/style.css';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
} from '@xyflow/react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CircleUserRound,
  Eye,
  EyeOff,
  Focus,
  Landmark,
  Layers3,
  Link2,
  LocateFixed,
  Network,
  Search,
  Smartphone,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import { getNetwork } from '../lib/api';
import { networkDemoCases } from '../lib/demo-cases';
import type { NetworkGraph, RiskLevel } from '../lib/types';
import { AppShell } from './app-shell';
import { DemoCasePicker } from './demo-case-picker';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from './ui';

type GraphNode = NetworkGraph['nodes'][number];
type GraphEdge = NetworkGraph['edges'][number];
type ViewMode = 'signals' | 'full';

const typeStyle = {
  customer: { color: '#174c82', background: '#edf4f8', icon: CircleUserRound, label: 'Customer' },
  device: { color: '#10483f', background: '#f1f6f4', icon: Smartphone, label: 'Device' },
  account: { color: '#108a43', background: '#eef7f2', icon: Landmark, label: 'Account' },
  dealer: { color: '#d97706', background: '#fffbeb', icon: Building2, label: 'Dealer' },
  location: { color: '#6b7280', background: '#f9fafb', icon: LocateFixed, label: 'Location' },
};

const edgeColors: Record<string, string> = {
  uses_device: '#10483f',
  linked_account: '#108a43',
  applied_via: '#d97706',
  located_in: '#9ca3af',
};

const relationshipLabels: Record<string, string> = {
  uses_device: 'uses device',
  linked_account: 'linked account',
  applied_via: 'applied via',
  located_in: 'located in',
};

export function NetworkExplorer() {
  const params = useSearchParams();
  const [customerId, setCustomerId] = useState(() => params.get('customer') ?? '');
  const [depth, setDepth] = useState(2);
  const [network, setNetwork] = useState<NetworkGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('signals');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayGraph = useMemo(
    () => (network ? selectDisplayGraph(network, viewMode) : null),
    [network, viewMode],
  );
  const mapped = useMemo(
    () =>
      displayGraph && network
        ? mapGraph(displayGraph.nodes, displayGraph.edges, network.customer_id, showEdgeLabels, viewMode)
        : { nodes: [], edges: [] },
    [displayGraph, network, showEdgeLabels, viewMode],
  );
  const evidence = useMemo(() => (network ? buildEvidenceRead(network) : []), [network]);

  async function loadNetwork(targetId: string) {
    const normalized = targetId.trim();
    if (!normalized) return;
    setCustomerId(normalized);
    setLoading(true);
    setError(null);
    try {
      const result = await getNetwork(normalized, { depth, maxNodes: 150 });
      setNetwork(result);
      setSelectedNodeId(result.customer_id);
      setViewMode('signals');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load network.');
      setNetwork(null);
      setSelectedNodeId(null);
    } finally {
      setLoading(false);
    }
  }

  async function explore(event: FormEvent) {
    event.preventDefault();
    await loadNetwork(customerId);
  }

  function changeView(nextMode: ViewMode) {
    setViewMode(nextMode);
    if (network) setSelectedNodeId(network.customer_id);
  }

  return (
    <AppShell activePath="/network">
      <div className="mx-auto max-w-[1600px]">
        <PageHeading
          eyebrow="Relationship analysis"
          title="Network Intelligence"
          description="See the evidence behind a customer ecosystem. Signal view prioritizes shared identity and dealer relationships; Full graph preserves the complete bounded result."
        />

        <form
          onSubmit={explore}
          className="mt-5 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
        >
          <label htmlFor="customer-id" className="relative">
            <span className="sr-only">Customer ID</span>
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="customer-id"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="Customer ID, e.g. CUS-S-005001"
              className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] pl-10 pr-3 text-xs font-medium focus:border-green-400 focus:bg-white"
            />
          </label>
          <label htmlFor="network-depth" className="relative">
            <span className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Depth</span>
            <select
              id="network-depth"
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="h-10 w-full appearance-none rounded-md border border-[var(--line)] bg-[var(--subtle)] px-3 pt-3 text-xs font-semibold focus:border-green-400 focus:bg-white"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || !customerId.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--blue)] px-5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Network size={16} /> Explore network
          </button>
        </form>
        <DemoCasePicker
          cases={networkDemoCases}
          selectedId={customerId}
          loading={loading}
          onSelect={(id) => void loadNetwork(id)}
          entityLabel="customer"
        />

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Resolving customer network" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : !network || !displayGraph ? (
            <EmptyPanel title="No network selected" description="Enter a customer ID to request a bounded graph from the entity-resolution API." />
          ) : (
            <div className="space-y-4">
              <NetworkBrief network={network} evidence={evidence} />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,2.25fr)_minmax(340px,.75fr)]">
                <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label="Interactive customer ecosystem graph">
                  <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#eef7f2] text-[var(--blue)]"><Layers3 size={15} /></span>
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--navy)]">Evidence map</h2>
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                          {displayGraph.nodes.length} visible nodes · {displayGraph.edges.length} relationships
                          {displayGraph.hiddenNodes > 0 ? ` · ${displayGraph.hiddenNodes} low-priority nodes hidden` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded-md border border-[var(--line)] bg-[var(--subtle)] p-0.5" aria-label="Graph view">
                        <ViewButton active={viewMode === 'signals'} onClick={() => changeView('signals')} icon={<Focus size={13} />} label="Signal view" />
                        <ViewButton active={viewMode === 'full'} onClick={() => changeView('full')} icon={<Network size={13} />} label="Full graph" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEdgeLabels((value) => !value)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 text-[10px] font-semibold text-slate-600"
                      >
                        {showEdgeLabels ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showEdgeLabels ? 'Hide labels' : 'Show labels'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[var(--line)] bg-[var(--subtle)] px-4 py-2.5">
                    {(Object.keys(typeStyle) as Array<keyof typeof typeStyle>).map((type) => {
                      const style = typeStyle[type];
                      const Icon = style.icon;
                      return (
                        <span key={type} className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em] text-slate-600">
                          <Icon size={11} style={{ color: style.color }} /> {style.label}
                        </span>
                      );
                    })}
                    <span className="ml-auto hidden text-[9px] text-[var(--muted)] sm:inline">Select any node to inspect its evidence</span>
                  </div>

                  <div className="h-[630px] bg-white">
                    <ReactFlow
                      nodes={mapped.nodes}
                      edges={mapped.edges}
                      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      minZoom={0.2}
                      maxZoom={2}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background variant={BackgroundVariant.Dots} color="#e5e7eb" gap={20} size={1} />
                      <Controls showInteractive={false} />
                      {viewMode === 'full' && (
                        <MiniMap pannable zoomable nodeColor={(node) => String(node.style?.borderColor ?? '#9ca3af')} maskColor="rgba(247,248,250,.82)" />
                      )}
                    </ReactFlow>
                  </div>
                </section>

                <aside className="space-y-4">
                  <EntityDetails network={network} selectedNodeId={selectedNodeId} />
                  <EvidenceNarrative evidence={evidence} />
                  <GraphScope network={network} visibleNodes={displayGraph.nodes.length} />
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NetworkBrief({ network, evidence }: { network: NetworkGraph; evidence: EvidenceRead[] }) {
  const focus = network.nodes.find((node) => node.id === network.customer_id);
  const strongest = evidence[0];
  const sharedEntityCount = evidence.filter((item) => item.customerCount > 1).length;
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label="Network interpretation summary">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <BriefFact label="Focus customer" value={network.customer_id} mono aside={focus?.risk_level ? <RiskBadge level={focus.risk_level} /> : undefined} />
        <BriefFact label="Linked applicants" value={network.summary.linked_applicant_count.toLocaleString('en-IN')} />
        <BriefFact label="Shared evidence entities" value={sharedEntityCount.toLocaleString('en-IN')} />
        <BriefFact label="Community" value={network.summary.community_id} mono />
      </div>
      <div className="flex items-start gap-3 border-t border-[#cfe5d8] bg-[#eef7f2] px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--blue)] text-white"><Link2 size={13} /></span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.1em] text-[var(--blue)]">What this graph proves</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--navy)]">
            {strongest
              ? `${strongest.customerCount} customers connect through ${strongest.entityLabel.toLowerCase()} ${strongest.entityId}; the graph makes that shared context visible around the focus customer.`
              : 'The graph shows only observed customer-to-entity relationships available at the selected depth and time boundary.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function BriefFact({ label, value, mono = false, aside }: { label: string; value: string; mono?: boolean; aside?: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[var(--line)] px-4 py-3 last:border-0 sm:border-r xl:border-b-0">
      <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <p className={`truncate text-base font-semibold text-[var(--navy)] ${mono ? 'font-mono text-xs' : ''}`} title={value}>{value}</p>
        {aside}
      </div>
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold ${active ? 'bg-white text-[var(--blue)]' : 'text-slate-500'}`}>
      {icon}{label}
    </button>
  );
}

function EntityDetails({ network, selectedNodeId }: { network: NetworkGraph; selectedNodeId: string | null }) {
  const selected = network.nodes.find((node) => node.id === selectedNodeId) ?? network.nodes[0];
  const related = network.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id);
  const firstObserved = related.length ? related.map((edge) => edge.first_seen).sort()[0] : network.as_of;
  const style = typeStyle[selected.type];
  const Icon = style.icon;
  return (
    <article className="panel">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: style.background, color: style.color }}><Icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Selected {selected.type}</p>{selected.risk_level && <RiskBadge level={selected.risk_level} />}</div>
          <h2 className="mt-1 truncate font-mono text-sm font-semibold text-[var(--navy)]" title={selected.id}>{selected.id}</h2>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{selected.label}</p>
        </div>
      </div>
      <dl className="mt-5 space-y-3">
        <GraphFact label="Direct connections" value={related.length} />
        <GraphFact label="First observed" value={new Date(firstObserved).toLocaleDateString('en-IN')} />
        <GraphFact label="Classification" value={selected.risk_level ?? 'Evidence entity'} />
        <GraphFact label="Focus entity" value={selected.is_focus ? 'Yes' : 'No'} />
      </dl>
      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Connection evidence</p>
        <div className="mt-3 space-y-2">
          {related.slice(0, 5).map((edge) => (
            <div key={edge.id} className="rounded-md border border-[var(--line)] bg-[var(--subtle)] px-3 py-2">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold capitalize text-[var(--navy)]">{relationshipLabels[edge.type] ?? edge.type.replaceAll('_', ' ')}</p><span className="text-[9px] font-medium text-[var(--muted)]">Strength {edge.strength.toFixed(1)}</span></div>
              <p className="mt-1 truncate font-mono text-[9px] text-[var(--muted)]">{edge.source === selected.id ? edge.target : edge.source}</p>
            </div>
          ))}
          {related.length === 0 && <p className="text-[11px] text-[var(--muted)]">No direct relationship is visible at this depth.</p>}
          {related.length > 5 && <p className="pt-1 text-[10px] font-medium text-[var(--blue)]">+ {related.length - 5} additional observed relationships</p>}
        </div>
      </div>
    </article>
  );
}

interface EvidenceRead {
  entityId: string;
  entityLabel: string;
  customerCount: number;
  color: string;
  message: string;
}

function EvidenceNarrative({ evidence }: { evidence: EvidenceRead[] }) {
  return (
    <article className="panel">
      <p className="eyebrow">Graph interpretation</p>
      <h2 className="panel-title">Strongest relationship signals</h2>
      <div className="mt-4 space-y-3">
        {evidence.slice(0, 4).map((item, index) => (
          <div key={item.entityId} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: item.color }}>{index + 1}</span>
            <div className="min-w-0"><p className="text-[11px] font-semibold text-[var(--navy)]">{item.message}</p><p className="mt-0.5 truncate font-mono text-[9px] text-[var(--muted)]">{item.entityId}</p></div>
          </div>
        ))}
        {evidence.length === 0 && <p className="text-xs leading-5 text-[var(--muted)]">No shared entity exceeds one connected customer in this bounded view.</p>}
      </div>
    </article>
  );
}

function GraphScope({ network, visibleNodes }: { network: NetworkGraph; visibleNodes: number }) {
  return (
    <article className="panel">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600"><Focus size={15} /></span><div><p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">Evidence boundary</p><p className="text-xs font-semibold text-[var(--navy)]">Observed as of {new Date(network.as_of).toLocaleDateString('en-IN')}</p></div></div>
      <dl className="mt-4 space-y-3"><GraphFact label="Visible / returned" value={`${visibleNodes} / ${network.summary.node_count}`} /><GraphFact label="Returned relationships" value={network.summary.edge_count} /><GraphFact label="Component density" value={network.summary.component_density.toFixed(3)} /></dl>
      {network.summary.truncated && (
        <div className="mt-4 flex gap-2 rounded-md bg-amber-50 p-3 text-[10px] leading-4 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={13} />API result capped at 150 nodes for a responsive investigation.</div>
      )}
      <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 p-3 text-[10px] font-semibold text-[var(--navy)]"><Banknote size={14} className="text-[var(--green)]" />Evidence supports review; it does not automatically decline.</div>
    </article>
  );
}

function selectDisplayGraph(graph: NetworkGraph, mode: ViewMode): { nodes: GraphNode[]; edges: GraphEdge[]; hiddenNodes: number } {
  if (mode === 'full') return { nodes: graph.nodes, edges: graph.edges, hiddenNodes: 0 };

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const focusId = graph.customer_id;
  const directEdges = graph.edges.filter((edge) => edge.source === focusId || edge.target === focusId);
  const directIds = directEdges.map((edge) => edge.source === focusId ? edge.target : edge.source);
  const evidenceNodes = directIds
    .map((id) => byId.get(id))
    .filter((node): node is GraphNode => Boolean(node))
    .sort((a, b) => typePriority(a.type) - typePriority(b.type));
  const included = new Set<string>([focusId, ...evidenceNodes.map((node) => node.id)]);

  for (const entity of evidenceNodes) {
    if (entity.type === 'location') continue;
    const connectedCustomers = graph.edges
      .filter((edge) => edge.source === entity.id || edge.target === entity.id)
      .map((edge) => edge.source === entity.id ? edge.target : edge.source)
      .map((id) => byId.get(id))
      .filter((node): node is GraphNode => Boolean(node && node.type === 'customer' && node.id !== focusId))
      .sort(compareCustomerRisk)
      .slice(0, 7);
    connectedCustomers.forEach((node) => included.add(node.id));
  }

  if (included.size === 1) graph.nodes.slice(0, 20).forEach((node) => included.add(node.id));
  const nodes = graph.nodes.filter((node) => included.has(node.id));
  const edges = graph.edges.filter((edge) => included.has(edge.source) && included.has(edge.target));
  return { nodes, edges, hiddenNodes: Math.max(0, graph.nodes.length - nodes.length) };
}

function mapGraph(nodes: GraphNode[], graphEdges: GraphEdge[], focusId: string, showLabels: boolean, mode: ViewMode): { nodes: Node[]; edges: Edge[] } {
  const positions = mode === 'signals' ? signalPositions(nodes, graphEdges, focusId) : fullPositions(nodes);
  const mappedNodes = nodes.map((item) => {
    const style = typeStyle[item.type];
    const Icon = style.icon;
    const focus = item.id === focusId;
    const label = (
      <div className="flex items-center gap-2 text-left">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${focus ? 'bg-white/15' : 'bg-white'}`}><Icon size={13} /></span>
        <span className="min-w-0"><span className="block truncate text-[10px] font-semibold">{focus ? 'Focus customer' : style.label}</span><span className={`block truncate font-mono text-[8px] ${focus ? 'text-[#d8eee1]' : 'opacity-65'}`}>{item.id}</span></span>
      </div>
    );
    return {
      id: item.id,
      position: positions.get(item.id) ?? { x: 0, y: 0 },
      data: { label },
      style: {
        width: focus ? 188 : 174,
        minHeight: 48,
        borderRadius: item.type === 'customer' ? 24 : 6,
        border: `${focus ? 2 : 1}px solid ${style.color}`,
        borderColor: style.color,
        background: focus ? style.color : style.background,
        color: focus ? '#fff' : style.color,
        fontWeight: 700,
        boxShadow: 'none',
        padding: '8px 10px',
      },
    } satisfies Node;
  });
  const mappedEdges = graphEdges.map((item) => {
    const touchesFocus = item.source === focusId || item.target === focusId;
    return {
      id: item.id,
      source: item.source,
      target: item.target,
      type: 'smoothstep',
      label: showLabels ? relationshipLabels[item.type] ?? item.type.replaceAll('_', ' ') : undefined,
      labelStyle: { fontSize: 8, fill: '#4b5563', fontWeight: 600 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
      style: { stroke: edgeColors[item.type] ?? '#9ca3af', strokeWidth: touchesFocus ? 2.2 : 1.3, opacity: touchesFocus ? 1 : 0.72 },
    } satisfies Edge;
  });
  return { nodes: mappedNodes, edges: mappedEdges };
}

function signalPositions(nodes: GraphNode[], edges: GraphEdge[], focusId: string) {
  const positions = new Map<string, { x: number; y: number }>();
  const customers = nodes.filter((node) => node.type === 'customer' && node.id !== focusId).sort(compareCustomerRisk);
  const evidence = nodes.filter((node) => node.type !== 'customer').sort((a, b) => typePriority(a.type) - typePriority(b.type));
  customers.forEach((node, index) => positions.set(node.id, { x: 760 + (index % 2) * 220, y: 35 + Math.floor(index / 2) * 78 }));
  evidence.forEach((node, index) => {
    const linkedY = edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => edge.source === node.id ? edge.target : edge.source)
      .map((id) => positions.get(id)?.y)
      .filter((value): value is number => value !== undefined);
    const fallback = 45 + index * 145;
    positions.set(node.id, { x: 410, y: linkedY.length ? linkedY.reduce((sum, value) => sum + value, 0) / linkedY.length : fallback });
  });
  const evidenceY = evidence.map((node) => positions.get(node.id)?.y ?? 0);
  positions.set(focusId, { x: 40, y: evidenceY.length ? evidenceY.reduce((sum, value) => sum + value, 0) / evidenceY.length : 250 });
  return positions;
}

function fullPositions(nodes: GraphNode[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const groups = new Map<string, number>();
  const columns: Record<GraphNode['type'], number> = { customer: 40, device: 360, account: 640, dealer: 920, location: 1200 };
  nodes.forEach((node) => {
    const row = groups.get(node.type) ?? 0;
    groups.set(node.type, row + 1);
    positions.set(node.id, { x: columns[node.type], y: 50 + row * 72 });
  });
  return positions;
}

function buildEvidenceRead(graph: NetworkGraph): EvidenceRead[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const directEntityIds = graph.edges
    .filter((edge) => edge.source === graph.customer_id || edge.target === graph.customer_id)
    .map((edge) => edge.source === graph.customer_id ? edge.target : edge.source);
  return directEntityIds
    .map((entityId) => byId.get(entityId))
    .filter((node): node is GraphNode => Boolean(node && node.type !== 'customer'))
    .map((entity) => {
      const customers = new Set(
        graph.edges
          .filter((edge) => edge.source === entity.id || edge.target === entity.id)
          .map((edge) => edge.source === entity.id ? edge.target : edge.source)
          .filter((id) => byId.get(id)?.type === 'customer'),
      );
      const style = typeStyle[entity.type];
      return {
        entityId: entity.id,
        entityLabel: style.label,
        customerCount: customers.size,
        color: style.color,
        message: `${customers.size} customer${customers.size === 1 ? '' : 's'} connected through one ${style.label.toLowerCase()}`,
      };
    })
    .sort((a, b) => evidencePriority(b) - evidencePriority(a));
}

function evidencePriority(item: EvidenceRead) {
  const typeWeight = item.entityLabel === 'Device' || item.entityLabel === 'Account' ? 1000 : item.entityLabel === 'Dealer' ? 500 : 0;
  return typeWeight + item.customerCount;
}

function typePriority(type: GraphNode['type']) {
  return { device: 0, account: 1, dealer: 2, location: 3, customer: 4 }[type];
}

function compareCustomerRisk(a: GraphNode, b: GraphNode) {
  const weight = (level: RiskLevel | null) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[level ?? 'LOW']);
  return weight(b.risk_level) - weight(a.risk_level) || a.id.localeCompare(b.id);
}

function GraphFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="text-xs font-semibold text-[var(--navy)]">{value}</dd>
    </div>
  );
}
