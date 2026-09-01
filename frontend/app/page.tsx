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
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleUserRound,
  Focus,
  Landmark,
  LoaderCircle,
  LocateFixed,
  MousePointer2,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from '../components/ui';
import { getDashboardSummary, getLiveMonitor, getNetwork } from '../lib/api';
import type { ActivityEvent, DashboardSummary, LiveMonitor, NetworkGraph, RiskLevel } from '../lib/types';

type GraphNode = NetworkGraph['nodes'][number];
type GraphEdge = NetworkGraph['edges'][number];

const number = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: 'compact',
});

const graphTypeStyle = {
  customer: { color: '#0057a8', background: '#eff6ff', label: 'Customer', icon: CircleUserRound },
  device: { color: '#0b1f3a', background: '#f3f4f6', label: 'Device', icon: Smartphone },
  account: { color: '#00843d', background: '#f0fdf4', label: 'Account', icon: Landmark },
  dealer: { color: '#d97706', background: '#fffbeb', label: 'Dealer', icon: Building2 },
  location: { color: '#6b7280', background: '#f9fafb', label: 'Location', icon: LocateFixed },
};

const edgeColors: Record<string, string> = {
  uses_device: '#0b1f3a',
  linked_account: '#00843d',
  applied_via: '#d97706',
  located_in: '#9ca3af',
};

export default function LiveMonitorPage() {
  const [monitor, setMonitor] = useState<LiveMonitor | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [network, setNetwork] = useState<NetworkGraph | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [revealCount, setRevealCount] = useState(1);
  const [graphPlaying, setGraphPlaying] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getLiveMonitor(20, controller.signal),
      getDashboardSummary(controller.signal),
    ])
      .then(([nextMonitor, nextSummary]) => {
        const initialCount = Math.min(6, nextMonitor.events.length);
        const initialEvents = [...nextMonitor.events].reverse().slice(0, initialCount).reverse();
        const initialEvent = initialEvents[0] ?? nextMonitor.events[0];
        setMonitor(nextMonitor);
        setSummary(nextSummary);
        setVisibleCount(initialCount);
        setSelectedApplicationId(initialEvent?.application_id ?? null);
        setAutoFollow(true);
        setGraphLoading(true);
        setGraphError(null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load the live monitor.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const visibleEvents = useMemo(() => {
    if (!monitor) return [];
    return [...monitor.events].reverse().slice(0, visibleCount).reverse();
  }, [monitor, visibleCount]);

  const selectedEvent = useMemo(
    () => monitor?.events.find((event) => event.application_id === selectedApplicationId) ?? null,
    [monitor, selectedApplicationId],
  );

  useEffect(() => {
    if (!monitor || visibleCount >= monitor.events.length) return;
    const timer = window.setInterval(() => {
      const nextCount = Math.min(visibleCount + 1, monitor.events.length);
      setVisibleCount(nextCount);
      if (autoFollow) {
        const nextEvents = [...monitor.events].reverse().slice(0, nextCount).reverse();
        const nextEvent = nextEvents[0];
        if (nextEvent && nextEvent.application_id !== selectedApplicationId) {
          setGraphLoading(true);
          setGraphError(null);
          setSelectedApplicationId(nextEvent.application_id);
        }
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [autoFollow, monitor, selectedApplicationId, visibleCount]);

  useEffect(() => {
    if (!selectedEvent) return;
    const controller = new AbortController();
    getNetwork(selectedEvent.customer_id, { depth: 2, maxNodes: 50 }, controller.signal)
      .then((nextNetwork) => {
        const nextSignalGraph = selectMonitorGraph(nextNetwork);
        setNetwork(nextNetwork);
        setSelectedNodeId(nextNetwork.customer_id);
        setRevealCount(Math.min(3, nextSignalGraph.nodes.length));
        setGraphPlaying(nextSignalGraph.nodes.length > 3);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setNetwork(null);
          setGraphError(reason instanceof Error ? reason.message : 'Unable to resolve this relationship graph.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGraphLoading(false);
      });
    return () => controller.abort();
  }, [selectedEvent]);

  const signalGraph = useMemo(() => (network ? selectMonitorGraph(network) : null), [network]);

  useEffect(() => {
    if (!signalGraph || !graphPlaying || revealCount >= signalGraph.nodes.length) return;
    const timer = window.setInterval(() => {
      setRevealCount((count) => {
        const next = Math.min(count + 1, signalGraph.nodes.length);
        if (next >= signalGraph.nodes.length) setGraphPlaying(false);
        return next;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [graphPlaying, revealCount, signalGraph]);

  const graph = useMemo(
    () => signalGraph && network
      ? mapMonitorGraph(signalGraph.nodes, signalGraph.edges, network.customer_id, revealCount, graphPlaying)
      : { nodes: [], edges: [] },
    [graphPlaying, network, revealCount, signalGraph],
  );

  const insights = useMemo(() => {
    const material = visibleEvents.filter((event) => event.status !== 'Analysed');
    return (material.length ? material : visibleEvents).slice(0, 4);
  }, [visibleEvents]);

  function focusEvent(event: ActivityEvent) {
    setAutoFollow(false);
    if (event.application_id === selectedApplicationId) return;
    setGraphLoading(true);
    setGraphError(null);
    setSelectedApplicationId(event.application_id);
  }

  function resumeLiveFollow() {
    setAutoFollow(true);
    if (visibleEvents[0] && visibleEvents[0].application_id !== selectedApplicationId) {
      setGraphLoading(true);
      setGraphError(null);
      setSelectedApplicationId(visibleEvents[0].application_id);
    }
  }

  function controlTrace() {
    if (!signalGraph) return;
    if (revealCount >= signalGraph.nodes.length) {
      setRevealCount(Math.min(2, signalGraph.nodes.length));
      setGraphPlaying(signalGraph.nodes.length > 2);
    } else {
      setGraphPlaying((value) => !value);
    }
  }

  return (
    <AppShell activePath="/">
      <div className="mx-auto max-w-[1600px]">
        <PageHeading
          eyebrow="Risk operations"
          title="Live Ecosystem Monitor"
          description="Monitoring lending activity and emerging relationship patterns across customers, devices, accounts, dealers, and locations."
          actions={
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setGraphLoading(true);
                setError(null);
                setRefreshKey((value) => value + 1);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          }
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--line)] bg-white px-4 py-2.5 text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--green)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" /> Stream operational</span>
            <span>Dataset {monitor?.dataset_id ?? '—'}</span>
            <span className="hidden sm:inline">Synthetic event replay · 30 second interval</span>
          </div>
          <span>Last evaluated {monitor ? new Date(monitor.data_timestamp).toLocaleString('en-IN') : '—'}</span>
        </div>

        {loading ? (
          <div className="mt-5"><LoadingPanel label="Connecting to lending activity" /></div>
        ) : error ? (
          <div className="mt-5"><ErrorPanel message={error} /></div>
        ) : monitor && summary ? (
          <>
            <section className="mt-5 grid min-h-[660px] gap-4 xl:grid-cols-[minmax(350px,.9fr)_minmax(540px,1.5fr)_minmax(300px,.72fr)]">
              <article className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <div className="flex h-[56px] items-center justify-between border-b border-[var(--line)] px-4">
                  <div><h2 className="text-sm font-semibold text-[var(--navy)]">Application stream</h2><p className="mt-0.5 text-[9px] text-[var(--muted)]">Select a row to inspect its ecosystem</p></div>
                  <button type="button" onClick={resumeLiveFollow} className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-semibold ${autoFollow ? 'bg-green-50 text-[var(--green)]' : 'bg-slate-100 text-slate-500'}`} aria-pressed={autoFollow}>
                    <Radio size={11} /> {autoFollow ? 'Following live' : 'Resume live'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-[11px]">
                    <thead className="border-b border-[var(--line)] bg-[var(--subtle)] text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">
                      <tr><th className="px-4 py-2.5">Time</th><th className="px-3 py-2.5">Application</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Dealer</th><th className="px-3 py-2.5">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {visibleEvents.map((event) => {
                        const selected = event.application_id === selectedApplicationId;
                        return (
                          <tr key={event.application_id} className={selected ? 'bg-blue-50' : 'cursor-pointer hover:bg-slate-50'} aria-selected={selected}>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-[var(--muted)]">{formatTime(event.timestamp)}</td>
                            <td className="px-3 py-3">
                              <button type="button" onClick={() => focusEvent(event)} className="inline-flex items-center gap-1.5 font-mono font-semibold text-[var(--navy)]" aria-label={`Focus graph on ${event.application_id}`}>
                                {selected && <Focus size={11} className="text-[var(--blue)]" />}{event.application_id}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{event.customer_id}</td>
                            <td className="px-3 py-3 font-mono text-slate-600">{event.dealer_id}</td>
                            <td className="px-3 py-3"><StatusLabel status={event.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <div className="flex h-[56px] items-center justify-between gap-3 border-b border-[var(--line)] px-4">
                  <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-[var(--navy)]">Relationship graph</h2>{graphPlaying && <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--green)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)]" /> Tracing</span>}</div><p className="mt-0.5 truncate text-[9px] text-[var(--muted)]">{selectedEvent ? `${selectedEvent.application_id} · ${selectedEvent.customer_id}` : 'Select an application'}</p></div>
                  <button type="button" onClick={controlTrace} disabled={!signalGraph || graphLoading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 text-[9px] font-semibold text-slate-600 disabled:opacity-50" aria-label={graphPlaying ? 'Pause relationship trace' : revealCount >= (signalGraph?.nodes.length ?? 0) ? 'Replay relationship trace' : 'Resume relationship trace'}>
                    {graphPlaying ? <Pause size={12} /> : revealCount >= (signalGraph?.nodes.length ?? 0) ? <RotateCcw size={12} /> : <Play size={12} />}
                    {graphPlaying ? 'Pause' : revealCount >= (signalGraph?.nodes.length ?? 0) ? 'Replay' : 'Resume'}
                  </button>
                </div>

                {selectedEvent && (
                  <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-b border-[var(--line)] bg-[var(--subtle)]">
                    <GraphContext label="Risk" value={`${selectedEvent.risk_score.toFixed(0)} · ${selectedEvent.risk_level}`} />
                    <GraphContext label="Signal" value={selectedEvent.primary_signal ? humanize(selectedEvent.primary_signal) : 'No material signal'} />
                    <GraphContext label="Graph state" value={signalGraph ? `${Math.min(revealCount, signalGraph.nodes.length)} of ${signalGraph.nodes.length} nodes` : 'Resolving'} />
                  </div>
                )}

                <div className="relative h-[552px]" aria-label="Live relationship graph">
                  {graphLoading ? (
                    <div className="grid h-full place-items-center text-center"><div><LoaderCircle className="mx-auto animate-spin text-[var(--blue)]" size={22} /><p className="mt-3 text-xs font-semibold text-[var(--navy)]">Loading selected ecosystem</p></div></div>
                  ) : graphError ? (
                    <div className="m-4"><ErrorPanel message={graphError} /></div>
                  ) : network && signalGraph ? (
                    <>
                      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
                        <GraphKey icon={CircleUserRound} label="Customer" color="#0057a8" />
                        <GraphKey icon={Smartphone} label="Device" color="#0b1f3a" />
                        <GraphKey icon={Landmark} label="Account" color="#00843d" />
                        <GraphKey icon={Building2} label="Dealer" color="#d97706" />
                      </div>
                      <LiveRelationshipCanvas graph={graph} onSelectNode={setSelectedNodeId} />
                      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded border border-[var(--line)] bg-white px-2 py-1 text-[9px] text-[var(--muted)]"><MousePointer2 size={11} /> Drag nodes · scroll to zoom · select to inspect</div>
                      {selectedNodeId && <SelectedGraphNode network={network} nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />}
                      {signalGraph.hiddenNodes > 0 && <div className="absolute bottom-3 right-3 z-10 rounded border border-[var(--line)] bg-white px-2 py-1 text-[9px] font-medium text-[var(--muted)]">{signalGraph.hiddenNodes} low-specificity nodes suppressed</div>}
                    </>
                  ) : null}
                </div>
              </article>

              <aside className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <PanelHeader title="Intelligence panel" detail="Recent insights" />
                <div className="divide-y divide-[var(--line)]">
                  {insights.map((event) => <InsightEvent key={event.application_id} event={event} onSelect={() => focusEvent(event)} selected={event.application_id === selectedApplicationId} />)}
                </div>
                <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-[var(--red)]"><ShieldAlert size={14} /> Needs attention</div>
                  <p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--navy)]">{summary.high_risk_ecosystems}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">High-risk connected ecosystems are routed for enhanced verification.</p>
                  <Link href="/investigate" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--blue)]">Open investigations <ArrowUpRight size={12} /></Link>
                </div>
              </aside>
            </section>

            <section className="mt-4 overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label="Portfolio snapshot">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                <SnapshotFact label="Applications monitored" value={number.format(summary.total_applications)} />
                <SnapshotFact label="Networks detected" value={number.format(summary.detected_networks)} />
                <SnapshotFact label="High-risk ecosystems" value={number.format(summary.high_risk_ecosystems)} tone="risk" />
                <SnapshotFact label="Review exposure" value={inr.format(summary.potential_exposure)} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function LiveRelationshipCanvas({ graph, onSelectNode }: { graph: { nodes: Node[]; edges: Edge[] }; onSelectNode: (id: string) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const instance = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const frame = window.requestAnimationFrame(() => instance.current?.fitView({ padding: 0.24, duration: 280 }));
    return () => window.cancelAnimationFrame(frame);
  }, [graph, setEdges, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onInit={(nextInstance) => { instance.current = nextInstance; }}
      fitView
      fitViewOptions={{ padding: 0.24 }}
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} color="#e5e7eb" gap={20} size={1} />
      <Controls showInteractive={false} />
      <MiniMap nodeColor={(node) => String(node.style?.borderColor ?? '#9ca3af')} maskColor="rgba(247,248,250,.84)" />
    </ReactFlow>
  );
}

function SelectedGraphNode({ network, nodeId, onClose }: { network: NetworkGraph; nodeId: string; onClose: () => void }) {
  const node = network.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const connections = network.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const style = graphTypeStyle[node.type];
  const Icon = style.icon;
  return (
    <div className="absolute right-3 top-3 z-20 w-[220px] rounded-md border border-[var(--line)] bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ color: style.color, background: style.background }}><Icon size={14} /></span>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">Selected {style.label}</p><p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-[var(--navy)]" title={node.id}>{node.id}</p></div>
        <button type="button" onClick={onClose} aria-label="Close entity details" className="text-slate-400"><X size={13} /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><SmallFact label="Connections" value={connections.length.toString()} /><SmallFact label="Risk" value={node.risk_level ?? 'Evidence'} /></div>
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return <div className="flex h-[56px] items-center justify-between border-b border-[var(--line)] px-4"><h2 className="text-sm font-semibold text-[var(--navy)]">{title}</h2><span className="text-[10px] text-[var(--muted)]">{detail}</span></div>;
}

function StatusLabel({ status }: { status: ActivityEvent['status'] }) {
  const classes = status === 'Requires Review' ? 'bg-red-50 text-red-700' : status === 'Relationship Found' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[9px] font-semibold ${classes}`}>{status}</span>;
}

function InsightEvent({ event, onSelect, selected }: { event: ActivityEvent; onSelect: () => void; selected: boolean }) {
  const high = event.risk_level === 'HIGH';
  return (
    <button type="button" onClick={onSelect} className={`w-full p-4 text-left ${selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`} aria-label={`Inspect insight for ${event.application_id}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded ${high ? 'bg-red-50 text-[var(--red)]' : 'bg-amber-50 text-[var(--amber)]'}`}>{high ? <AlertTriangle size={14} /> : <Network size={14} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-[var(--navy)]">{event.primary_signal ? humanize(event.primary_signal) : 'Relationship discovered'}</p><RiskBadge level={event.risk_level} /></div>
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--muted)]">{event.device_id} · {event.dealer_id}</p>
          <div className="mt-2 flex items-center justify-between text-[10px]"><span className="font-mono text-slate-500">{event.application_id}</span><span className="font-semibold text-[var(--navy)]">Risk {event.risk_score.toFixed(0)}</span></div>
        </div>
      </div>
    </button>
  );
}

function GraphKey({ icon: Icon, label, color }: { icon: typeof Smartphone; label: string; color: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] bg-white px-2 py-1 text-[9px] font-medium text-slate-500"><Icon size={11} style={{ color }} />{label}</span>;
}

function GraphContext({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-3 py-2"><p className="text-[8px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-0.5 truncate text-[9px] font-semibold text-[var(--navy)]" title={value}>{value}</p></div>;
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-[var(--line)] bg-[var(--subtle)] p-2"><p className="text-[8px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 truncate text-[10px] font-semibold text-[var(--navy)]">{value}</p></div>;
}

function SnapshotFact({ label, value, tone }: { label: string; value: string; tone?: 'risk' }) {
  return <div className="border-b border-[var(--line)] px-5 py-4 last:border-0 sm:border-r xl:border-b-0"><p className="text-[10px] font-medium text-[var(--muted)]">{label}</p><p className={`mt-1 text-xl font-semibold tracking-[-.03em] ${tone === 'risk' ? 'text-[var(--red)]' : 'text-[var(--navy)]'}`}>{value}</p></div>;
}

function selectMonitorGraph(graph: NetworkGraph): { nodes: GraphNode[]; edges: GraphEdge[]; hiddenNodes: number } {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const directEdges = graph.edges.filter((edge) => edge.source === graph.customer_id || edge.target === graph.customer_id);
  const evidenceNodes = directEdges
    .map((edge) => byId.get(edge.source === graph.customer_id ? edge.target : edge.source))
    .filter((node): node is GraphNode => Boolean(node))
    .sort((a, b) => graphTypePriority(a.type) - graphTypePriority(b.type));
  const relatedCustomers: GraphNode[] = [];
  const includedCustomers = new Set<string>();
  for (const evidence of evidenceNodes) {
    if (evidence.type === 'location') continue;
    graph.edges
      .filter((edge) => edge.source === evidence.id || edge.target === evidence.id)
      .map((edge) => byId.get(edge.source === evidence.id ? edge.target : edge.source))
      .filter((node): node is GraphNode => Boolean(node && node.type === 'customer' && node.id !== graph.customer_id))
      .sort(compareCustomerRisk)
      .slice(0, 5)
      .forEach((node) => {
        if (!includedCustomers.has(node.id)) {
          includedCustomers.add(node.id);
          relatedCustomers.push(node);
        }
      });
  }
  let nodes = [byId.get(graph.customer_id), ...evidenceNodes, ...relatedCustomers].filter((node): node is GraphNode => Boolean(node));
  if (nodes.length < 4) {
    const included = new Set(nodes.map((node) => node.id));
    for (const node of graph.nodes) {
      if (!included.has(node.id)) nodes.push(node);
      if (nodes.length >= Math.min(10, graph.nodes.length)) break;
    }
  }
  nodes = nodes.slice(0, 18);
  const selected = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target));
  return { nodes, edges, hiddenNodes: Math.max(0, graph.nodes.length - nodes.length) };
}

function mapMonitorGraph(graphNodes: GraphNode[], graphEdges: GraphEdge[], focusId: string, revealCount: number, animate: boolean): { nodes: Node[]; edges: Edge[] } {
  const visibleNodes = graphNodes.slice(0, Math.max(1, revealCount));
  const selected = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graphEdges.filter((edge) => selected.has(edge.source) && selected.has(edge.target));
  const positions = monitorPositions(visibleNodes, visibleEdges, focusId);
  const nodes = visibleNodes.map((item) => {
    const style = graphTypeStyle[item.type];
    const Icon = style.icon;
    const focus = item.id === focusId;
    return {
      id: item.id,
      position: positions.get(item.id) ?? { x: 0, y: 0 },
      data: {
        label: (
          <div className="flex items-center gap-2 text-left">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${focus ? 'bg-white/15' : 'bg-white'}`}><Icon size={13} /></span>
            <span className="min-w-0"><span className="block truncate text-[10px] font-semibold">{focus ? 'Focus customer' : style.label}</span><span className={`block truncate font-mono text-[8px] ${focus ? 'text-blue-100' : 'opacity-65'}`}>{item.id}</span></span>
          </div>
        ),
      },
      style: {
        width: focus ? 178 : 164,
        minHeight: 46,
        borderRadius: item.type === 'customer' ? 24 : 6,
        border: `${focus ? 2 : 1}px solid ${style.color}`,
        borderColor: style.color,
        background: focus ? style.color : style.background,
        color: focus ? '#fff' : style.color,
        boxShadow: 'none',
        padding: '8px 10px',
      },
    } satisfies Node;
  });
  const edges = visibleEdges.map((edge) => {
    const touchesFocus = edge.source === focusId || edge.target === focusId;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: animate && !touchesFocus,
      label: edge.type.replaceAll('_', ' '),
      labelStyle: { fontSize: 7, fill: '#4b5563', fontWeight: 600 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.94 },
      labelBgPadding: [3, 2] as [number, number],
      labelBgBorderRadius: 3,
      style: { stroke: edgeColors[edge.type] ?? '#9ca3af', strokeWidth: touchesFocus ? 2.2 : 1.3, opacity: touchesFocus ? 1 : 0.76 },
    } satisfies Edge;
  });
  return { nodes, edges };
}

function monitorPositions(nodes: GraphNode[], edges: GraphEdge[], focusId: string) {
  const positions = new Map<string, { x: number; y: number }>();
  const customers = nodes.filter((node) => node.type === 'customer' && node.id !== focusId).sort(compareCustomerRisk);
  const evidence = nodes.filter((node) => node.type !== 'customer').sort((a, b) => graphTypePriority(a.type) - graphTypePriority(b.type));
  customers.forEach((node, index) => positions.set(node.id, { x: 650 + (index % 2) * 205, y: 35 + Math.floor(index / 2) * 76 }));
  evidence.forEach((node, index) => {
    const linkedY = edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => positions.get(edge.source === node.id ? edge.target : edge.source)?.y)
      .filter((value): value is number => value !== undefined);
    positions.set(node.id, { x: 340, y: linkedY.length ? linkedY.reduce((sum, value) => sum + value, 0) / linkedY.length : 55 + index * 115 });
  });
  const evidenceY = evidence.map((node) => positions.get(node.id)?.y ?? 0);
  positions.set(focusId, { x: 30, y: evidenceY.length ? evidenceY.reduce((sum, value) => sum + value, 0) / evidenceY.length : 220 });
  return positions;
}

function graphTypePriority(type: GraphNode['type']) {
  return { device: 0, account: 1, dealer: 2, location: 3, customer: 4 }[type];
}

function compareCustomerRisk(a: GraphNode, b: GraphNode) {
  const weight = (level: RiskLevel | null) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[level ?? 'LOW']);
  return weight(b.risk_level) - weight(a.risk_level) || a.id.localeCompare(b.id);
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
