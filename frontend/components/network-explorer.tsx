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
  customer: { color: '#1b62ff', background: '#eaf0ff', icon: Users },
  device: { color: '#7656df', background: '#f0ecff', icon: Smartphone },
  account: { color: '#078b67', background: '#e2f7f0', icon: Landmark },
  dealer: { color: '#c26d0a', background: '#fff1d9', icon: Building2 },
  location: { color: '#617087', background: '#eef2f6', icon: LocateFixed },
};

const edgeColors: Record<string, string> = {
  uses_device: '#7656df',
  linked_account: '#0fb283',
  applied_via: '#f3a62b',
  located_in: '#8d99aa',
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load network.');
      setNetwork(null);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell activePath="/network">
      <div className="mx-auto max-w-[1500px]">
        <PageHeading
          eyebrow="Network explorer"
          title="Follow every relationship."
          description="Traverse a bounded customer ecosystem across devices, accounts, dealers, and locations. Drag nodes, zoom, and inspect the evidence topology."
        />

        <form
          onSubmit={explore}
          className="panel mt-7 grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
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
              className="h-12 w-full rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-sm font-medium focus:border-blue-200 focus:bg-white"
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
              className="h-12 w-full appearance-none rounded-xl border border-transparent bg-slate-50 px-3 pt-3 text-sm font-semibold focus:border-blue-200 focus:bg-white"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || !customerId.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-6 text-sm font-semibold text-white disabled:opacity-50"
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
              <section className="panel relative h-[640px] overflow-hidden p-0" aria-label="Interactive customer ecosystem graph">
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  {Object.entries(typeStyle).map(([type, style]) => (
                    <span key={type} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider shadow-sm backdrop-blur">
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
                    maskColor="rgba(243,246,250,.75)"
                  />
                </ReactFlow>
              </section>

              <aside className="space-y-4">
                <article className="panel">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]">
                      <Focus size={17} />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Focus customer</p>
                      <p className="text-sm font-bold text-[var(--navy)]">{network.customer_id}</p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-3">
                    <GraphFact label="Visible nodes" value={network.summary.node_count} />
                    <GraphFact label="Visible edges" value={network.summary.edge_count} />
                    <GraphFact label="Linked applicants" value={network.summary.linked_applicant_count} />
                    <GraphFact label="Component density" value={network.summary.component_density.toFixed(3)} />
                  </dl>
                  {network.summary.truncated && (
                    <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                      <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                      View capped at 150 nodes for responsive investigation.
                    </div>
                  )}
                </article>

                <article className="panel">
                  <p className="eyebrow">Graph context</p>
                  <h2 className="panel-title">{network.summary.community_id}</h2>
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
        borderRadius: 13,
        border: `${item.is_focus ? 3 : 1.5}px solid ${style.color}`,
        background: item.is_focus ? style.color : style.background,
        color: item.is_focus ? '#fff' : style.color,
        fontSize: 11,
        fontWeight: 700,
        boxShadow: item.is_focus
          ? '0 12px 32px rgba(27,98,255,.22)'
          : '0 5px 16px rgba(17,31,55,.07)',
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
