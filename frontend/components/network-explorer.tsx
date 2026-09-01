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
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Focus,
  Landmark,
  LocateFixed,
  Network,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { getNetwork } from '../lib/api';
import type { NetworkGraph } from '../lib/types';
import { AppShell } from './app-shell';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from './ui';

const typeStyle = {
  customer: { color: '#0057a8', background: '#eff6ff', icon: Users },
  device: { color: '#0b1f3a', background: '#f3f4f6', icon: Smartphone },
  account: { color: '#00843d', background: '#f0fdf4', icon: Landmark },
  dealer: { color: '#d97706', background: '#fffbeb', icon: Building2 },
  location: { color: '#6b7280', background: '#f9fafb', icon: LocateFixed },
};

const edgeColors: Record<string, string> = {
  uses_device: '#0b1f3a',
  linked_account: '#00843d',
  applied_via: '#d97706',
  located_in: '#9ca3af',
};

export function NetworkExplorer() {
  const params = useSearchParams();
  const [customerId, setCustomerId] = useState(
    () => params.get('customer') ?? '',
  );
  const [depth, setDepth] = useState(2);
  const [network, setNetwork] = useState<NetworkGraph | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explore(event: FormEvent) {
    event.preventDefault();
    const normalized = customerId.trim();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getNetwork(normalized, { depth, maxNodes: 150 });
      const mapped = mapGraph(result);
      setNetwork(result);
      setNodes(mapped.nodes);
      setEdges(mapped.edges);
      setSelectedNodeId(result.customer_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load network.');
      setNetwork(null);
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell activePath="/network">
      <div className="mx-auto max-w-[1500px]">
        <PageHeading
          eyebrow="Relationship analysis"
          title="Network Intelligence"
          description="Investigate meaningful links across customers, devices, accounts, dealers, and locations. Select any entity to inspect its evidence."
        />

        <form
          onSubmit={explore}
          className="mt-5 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
        >
          <label htmlFor="customer-id" className="relative">
            <span className="sr-only">Customer ID</span>
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="customer-id"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="Customer ID, e.g. CUS-S-005001"
              className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] pl-10 pr-3 text-xs font-medium focus:border-blue-300 focus:bg-white"
            />
          </label>
          <label htmlFor="network-depth" className="relative">
            <span className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Depth
            </span>
            <select
              id="network-depth"
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
              className="h-10 w-full appearance-none rounded-md border border-[var(--line)] bg-[var(--subtle)] px-3 pt-3 text-xs font-semibold focus:border-blue-300 focus:bg-white"
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
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Standard seed demo: try{' '}
          <button
            type="button"
            onClick={() => setCustomerId('CUS-S-005001')}
            className="font-semibold text-[var(--blue)] hover:underline"
          >
            CUS-S-005001
          </button>
        </p>

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Resolving customer network" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : !network ? (
            <EmptyPanel
              title="No network selected"
              description="Enter a customer ID to request a bounded graph from the entity-resolution API."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,.8fr)]">
              <section className="relative h-[660px] overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label="Interactive customer ecosystem graph">
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  {Object.entries(typeStyle).map(([type, style]) => (
                    <span key={type} className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider">
                      <span className="h-2 w-2 rounded-full" style={{ background: style.color }} />
                      {type}
                    </span>
                  ))}
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                  minZoom={0.2}
                  maxZoom={2}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background variant={BackgroundVariant.Dots} color="#d7deea" gap={18} />
                  <Controls showInteractive={false} />
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={(node) => String(node.style?.borderColor ?? '#8d99aa')}
                    maskColor="rgba(247,248,250,.8)"
                  />
                </ReactFlow>
              </section>

              <aside className="space-y-4">
                <EntityDetails network={network} selectedNodeId={selectedNodeId} />

                <article className="panel">
                  <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-[var(--blue)]"><Focus size={15} /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Network summary</p><p className="text-xs font-semibold text-[var(--navy)]">{network.summary.community_id}</p></div></div>
                  <dl className="mt-4 space-y-3"><GraphFact label="Visible nodes" value={network.summary.node_count} /><GraphFact label="Visible edges" value={network.summary.edge_count} /><GraphFact label="Linked applicants" value={network.summary.linked_applicant_count} /><GraphFact label="Component density" value={network.summary.component_density.toFixed(3)} /></dl>
                  {network.summary.truncated && (
                    <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                      <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                      View capped at 150 nodes for responsive investigation.
                    </div>
                  )}
                </article>

                <article className="panel">
                  <p className="eyebrow">Evidence boundary</p>
                  <h2 className="panel-title">Observed relationships</h2>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    Relationships shown are direct observed entity links, filtered as of{' '}
                    {new Date(network.as_of).toLocaleString('en-IN')}.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-[var(--navy)]">
                    <Banknote size={15} className="text-[var(--green)]" /> Evidence, not automatic decline
                  </div>
                </article>
              </aside>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EntityDetails({ network, selectedNodeId }: { network: NetworkGraph; selectedNodeId: string | null }) {
  const selected = network.nodes.find((node) => node.id === selectedNodeId) ?? network.nodes[0];
  const related = network.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id);
  const firstObserved = related.length
    ? related.map((edge) => edge.first_seen).sort()[0]
    : network.as_of;
  const style = typeStyle[selected.type as keyof typeof typeStyle] ?? typeStyle.location;
  const Icon = style.icon;
  return (
    <article className="panel">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md" style={{ background: style.background, color: style.color }}><Icon size={17} /></span>
        <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Selected {selected.type}</p><h2 className="mt-0.5 truncate font-mono text-sm font-semibold text-[var(--navy)]">{selected.id}</h2></div>
      </div>
      <dl className="mt-5 space-y-3"><GraphFact label="Direct connections" value={related.length} /><GraphFact label="First observed" value={new Date(firstObserved).toLocaleDateString('en-IN')} /><GraphFact label="Risk classification" value={selected.risk_level ?? 'Evidence only'} /><GraphFact label="Focus entity" value={selected.is_focus ? 'Yes' : 'No'} /></dl>
      <div className="mt-5 border-t border-[var(--line)] pt-4"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Relationship evidence</p><div className="mt-3 space-y-2">{related.slice(0, 4).map((edge) => <div key={edge.id} className="rounded-md bg-[var(--subtle)] px-3 py-2"><p className="text-[10px] font-semibold text-[var(--navy)]">{edge.type.replaceAll('_', ' ')}</p><p className="mt-1 truncate font-mono text-[9px] text-[var(--muted)]">{edge.source === selected.id ? edge.target : edge.source}</p></div>)}{related.length === 0 && <p className="text-[11px] text-[var(--muted)]">No direct relationship is visible at this depth.</p>}</div></div>
    </article>
  );
}

function mapGraph(graph: NetworkGraph): { nodes: Node[]; edges: Edge[] } {
  const groups = new Map<string, number>();
  const columns: Record<string, number> = {
    customer: 80,
    device: 390,
    account: 680,
    dealer: 970,
    location: 1260,
  };
  const nodes = graph.nodes.map((item) => {
    const row = groups.get(item.type) ?? 0;
    groups.set(item.type, row + 1);
    const style = typeStyle[item.type];
    return {
      id: item.id,
      position: { x: columns[item.type], y: 90 + row * 92 },
      data: { label: item.label },
      style: {
        width: 176,
        minHeight: 48,
        borderRadius: item.type === 'customer' ? 999 : 6,
        border: `${item.is_focus ? 2 : 1}px solid ${style.color}`,
        background: item.is_focus ? style.color : style.background,
        color: item.is_focus ? '#fff' : style.color,
        fontSize: 11,
        fontWeight: 700,
        boxShadow: 'none',
      },
    } satisfies Node;
  });
  const edges = graph.edges.map((item) => ({
    id: item.id,
    source: item.source,
    target: item.target,
    label: item.type.replaceAll('_', ' '),
    labelStyle: { fontSize: 8, fill: '#6f7b8f', fontWeight: 600 },
    style: { stroke: edgeColors[item.type] ?? '#9aa6b7', strokeWidth: 1.5 },
  } satisfies Edge));
  return { nodes, edges };
}

function GraphFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-bold text-[var(--navy)]">{value}</dd>
    </div>
  );
}
