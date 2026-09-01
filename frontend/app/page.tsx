'use client';

import '@xyflow/react/dist/style.css';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
} from '@xyflow/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Link2,
  Network,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from '../components/ui';
import { getDashboardSummary, getLiveMonitor, getNetwork } from '../lib/api';
import type { ActivityEvent, DashboardSummary, LiveMonitor, NetworkGraph } from '../lib/types';

const number = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: 'compact',
});

export default function LiveMonitorPage() {
  const [monitor, setMonitor] = useState<LiveMonitor | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [network, setNetwork] = useState<NetworkGraph | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getLiveMonitor(20, controller.signal),
      getDashboardSummary(controller.signal),
    ])
      .then(async ([nextMonitor, nextSummary]) => {
        const nextNetwork = await getNetwork(
          nextMonitor.focus_customer_id,
          { depth: 2, maxNodes: 50 },
          controller.signal,
        );
        setMonitor(nextMonitor);
        setSummary(nextSummary);
        setNetwork(nextNetwork);
        setVisibleCount(Math.min(6, nextMonitor.events.length));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load the live monitor.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!monitor || visibleCount >= monitor.events.length) return;
    const timer = window.setInterval(() => {
      setVisibleCount((count) => Math.min(count + 1, monitor.events.length));
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [monitor, visibleCount]);

  const visibleEvents = useMemo(() => {
    if (!monitor) return [];
    return [...monitor.events].reverse().slice(0, visibleCount).reverse();
  }, [monitor, visibleCount]);

  const graph = useMemo(
    () => (network ? mapMonitorGraph(network, visibleCount) : { nodes: [], edges: [] }),
    [network, visibleCount],
  );
  const insights = useMemo(() => {
    const material = visibleEvents.filter((event) => event.status !== 'Analysed');
    return (material.length ? material : visibleEvents).slice(0, 4);
  }, [visibleEvents]);

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
            <span className="hidden sm:inline">Synthetic event replay · 5 second interval</span>
          </div>
          <span>Last evaluated {monitor ? new Date(monitor.data_timestamp).toLocaleString('en-IN') : '—'}</span>
        </div>

        {loading ? (
          <div className="mt-5"><LoadingPanel label="Connecting to lending activity" /></div>
        ) : error ? (
          <div className="mt-5"><ErrorPanel message={error} /></div>
        ) : monitor && network ? (
          <>
            <section className="mt-5 grid min-h-[610px] gap-4 xl:grid-cols-[minmax(350px,.9fr)_minmax(520px,1.45fr)_minmax(300px,.72fr)]">
              <article className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <PanelHeader title="Application stream" detail={`${visibleEvents.length} of ${monitor.events.length} events`} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-[11px]">
                    <thead className="border-b border-[var(--line)] bg-[var(--subtle)] text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]">
                      <tr><th className="px-4 py-2.5">Time</th><th className="px-3 py-2.5">Application</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Dealer</th><th className="px-3 py-2.5">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {visibleEvents.map((event, index) => (
                        <tr key={event.application_id} className={index === 0 ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-[var(--muted)]">{formatTime(event.timestamp)}</td>
                          <td className="px-3 py-3 font-mono font-semibold text-[var(--navy)]">{event.application_id}</td>
                          <td className="px-3 py-3 text-slate-600">{event.customer_id}</td>
                          <td className="px-3 py-3 font-mono text-slate-600">{event.dealer_id}</td>
                          <td className="px-3 py-3"><StatusLabel status={event.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <PanelHeader title="Relationship graph" detail={`Focus · ${network.customer_id}`} />
                <div className="absolute left-4 top-[58px] z-10 flex flex-wrap gap-2">
                  <GraphKey icon={Smartphone} label="Device" />
                  <GraphKey icon={Building2} label="Dealer" />
                  <GraphKey icon={Link2} label="Observed relationship" />
                </div>
                <div className="h-[556px]" aria-label="Live relationship graph">
                  <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView minZoom={0.35} maxZoom={1.8} nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
                    <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={20} size={1} />
                    <Controls showInteractive={false} />
                  </ReactFlow>
                </div>
              </article>

              <aside className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <PanelHeader title="Intelligence panel" detail="Recent insights" />
                <div className="divide-y divide-[var(--line)]">
                  {insights.map((event) => <InsightEvent key={event.application_id} event={event} />)}
                </div>
                <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-[var(--red)]"><ShieldAlert size={14} /> Needs attention</div>
                  <p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--navy)]">{summary?.high_risk_ecosystems ?? '—'}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-600">High-risk connected ecosystems are routed for enhanced verification.</p>
                  <Link href="/investigate" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--blue)]">Open investigations <ArrowUpRight size={12} /></Link>
                </div>
              </aside>
            </section>

            <section className="mt-4 overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label="Portfolio snapshot">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                <SnapshotFact label="Applications monitored" value={summary ? number.format(summary.total_applications) : '—'} />
                <SnapshotFact label="Networks detected" value={summary ? number.format(summary.detected_networks) : '—'} />
                <SnapshotFact label="High-risk ecosystems" value={summary ? number.format(summary.high_risk_ecosystems) : '—'} tone="risk" />
                <SnapshotFact label="Review exposure" value={summary ? inr.format(summary.potential_exposure) : '—'} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return <div className="flex h-[52px] items-center justify-between border-b border-[var(--line)] px-4"><h2 className="text-sm font-semibold text-[var(--navy)]">{title}</h2><span className="text-[10px] text-[var(--muted)]">{detail}</span></div>;
}

function StatusLabel({ status }: { status: ActivityEvent['status'] }) {
  const classes = status === 'Requires Review' ? 'bg-red-50 text-red-700' : status === 'Relationship Found' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700';
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[9px] font-semibold ${classes}`}>{status}</span>;
}

function InsightEvent({ event }: { event: ActivityEvent }) {
  const high = event.risk_level === 'HIGH';
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded ${high ? 'bg-red-50 text-[var(--red)]' : 'bg-amber-50 text-[var(--amber)]'}`}>{high ? <AlertTriangle size={14} /> : <Network size={14} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-[var(--navy)]">{event.primary_signal ? humanize(event.primary_signal) : 'Relationship discovered'}</p><RiskBadge level={event.risk_level} /></div>
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--muted)]">{event.device_id} · {event.dealer_id}</p>
          <div className="mt-2 flex items-center justify-between text-[10px]"><span className="font-mono text-slate-500">{event.application_id}</span><span className="font-semibold text-[var(--navy)]">Risk {event.risk_score.toFixed(0)}</span></div>
        </div>
      </div>
    </div>
  );
}

function GraphKey({ icon: Icon, label }: { icon: typeof Smartphone; label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] bg-white px-2 py-1 text-[9px] font-medium text-slate-500"><Icon size={11} />{label}</span>;
}

function SnapshotFact({ label, value, tone }: { label: string; value: string; tone?: 'risk' }) {
  return <div className="border-b border-[var(--line)] px-5 py-4 last:border-0 sm:border-r xl:border-b-0"><p className="text-[10px] font-medium text-[var(--muted)]">{label}</p><p className={`mt-1 text-xl font-semibold tracking-[-.03em] ${tone === 'risk' ? 'text-[var(--red)]' : 'text-[var(--navy)]'}`}>{value}</p></div>;
}

function mapMonitorGraph(graph: NetworkGraph, visibleCount: number): { nodes: Node[]; edges: Edge[] } {
  const maxVisible = Math.min(graph.nodes.length, Math.max(4, visibleCount));
  const selected = new Set(graph.nodes.slice(0, maxVisible).map((item) => item.id));
  const rows = new Map<string, number>();
  const columns: Record<string, number> = { customer: 40, device: 310, account: 520, dealer: 310, location: 520 };
  const nodes = graph.nodes.filter((item) => selected.has(item.id)).map((item) => {
    const row = rows.get(item.type) ?? 0;
    rows.set(item.type, row + 1);
    const color = item.type === 'customer' ? '#0057a8' : item.type === 'dealer' ? '#d97706' : item.type === 'account' ? '#00843d' : '#0b1f3a';
    return {
      id: item.id,
      position: { x: columns[item.type] ?? 520, y: 80 + row * 100 },
      data: { label: item.label },
      style: {
        width: item.type === 'customer' ? 92 : 142,
        height: item.type === 'customer' ? 72 : 44,
        borderRadius: item.type === 'customer' ? 999 : 6,
        border: `${item.is_focus ? 2 : 1}px solid ${color}`,
        background: item.is_focus ? color : '#fff',
        color: item.is_focus ? '#fff' : '#374151',
        fontSize: 10,
        fontWeight: 600,
        boxShadow: 'none',
      },
    } satisfies Node;
  });
  const edges = graph.edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target)).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.type.replaceAll('_', ' '),
    labelStyle: { fontSize: 8, fill: '#6b7280' },
    style: { stroke: '#9ca3af', strokeWidth: 1.2 },
  } satisfies Edge));
  return { nodes, edges };
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
