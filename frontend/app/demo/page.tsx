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
  ArrowRight,
  Building2,
  CheckCircle2,
  GitCompareArrows,
  Play,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from '../../components/ui';
import { simulateEmergingRisk } from '../../lib/api';
import type { DemoSimulation, DemoRiskSnapshot } from '../../lib/types';

const nodeStyle: Record<string, { background: string; border: string; color: string }> = {
  focus_customer: { background: '#1b62ff', border: '#1b62ff', color: '#fff' },
  applicant: { background: '#eaf0ff', border: '#1b62ff', color: '#174cb8' },
  shared_device: { background: '#f0ecff', border: '#7656df', color: '#6544ca' },
  dealer: { background: '#fff1d9', border: '#f3a62b', color: '#9a6510' },
};

export default function DemoPage() {
  const [simulation, setSimulation] = useState<DemoSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      setSimulation(await simulateEmergingRisk());
    } catch (reason) {
      setSimulation(null);
      setError(reason instanceof Error ? reason.message : 'Unable to run the scenario.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell activePath="/demo">
      <div className="mx-auto max-w-[1500px]">
        <PageHeading
          eyebrow="One-click demo"
          title="Watch ecosystem risk emerge."
          description="Start with one individually plausible borrower, introduce connected applications, and let the same graph, temporal, and risk engines recompute the outcome."
          actions={
            <button
              type="button"
              onClick={runSimulation}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-6 text-sm font-bold text-white shadow-[0_10px_30px_rgba(27,98,255,.25)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {simulation ? <RefreshCw size={16} /> : <Play size={16} />}
              {simulation ? 'Run a fresh scenario' : 'Simulate Emerging Risk Ecosystem'}
            </button>
          }
        />

        <section className="mt-7 overflow-hidden rounded-[24px] bg-[var(--navy)] px-6 py-7 text-white shadow-[0_18px_55px_rgba(16,28,53,.16)] sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--aqua)]">
                <Sparkles size={14} /> Computed—not scripted
              </div>
              <h2 className="mt-4 max-w-xl text-2xl font-bold tracking-[-.035em] sm:text-3xl">
                Individual risk looks safe. The connected network changes the decision context.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Each click creates a fresh scenario namespace. It never overwrites the active portfolio or cached analyses.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <HeroFact label="Baseline" value="1 applicant" />
              <HeroFact label="Emerges" value="6 applicants" />
              <HeroFact label="Window" value="Under 2h" />
            </div>
          </div>
        </section>

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Simulating the emerging ecosystem" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : !simulation ? (
            <section className="panel grid min-h-[310px] place-items-center text-center">
              <div className="max-w-lg">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[var(--blue)]">
                  <GitCompareArrows size={24} />
                </span>
                <h2 className="mt-5 text-lg font-bold text-[var(--navy)]">Ready for the before-and-after journey</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Run the simulation to generate the isolated applicant records, resolve their relationships, and calculate both risk states on the backend.
                </p>
              </div>
            </section>
          ) : (
            <SimulationResult simulation={simulation} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SimulationResult({ simulation }: { simulation: DemoSimulation }) {
  const graph = useMemo(() => mapDemoGraph(simulation), [simulation]);

  return (
    <div className="space-y-4" aria-live="polite">
      <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <RiskStateCard stage="Before" snapshot={simulation.before} customer="Customer A" />
        <div className="grid place-items-center text-[var(--blue)]" aria-hidden="true">
          <span className="grid h-11 w-11 rotate-90 place-items-center rounded-full border border-blue-100 bg-blue-50 lg:rotate-0">
            <ArrowRight size={19} />
          </span>
        </div>
        <RiskStateCard stage="After network analysis" snapshot={simulation.after} customer="Customer A" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <EvidenceCard icon={Smartphone} label="Shared device" value={`${simulation.after.shared_device_applicant_count} applicants`} detail={simulation.network.summary.shared_device_id} />
        <EvidenceCard icon={Users} label="Multiple applicants" value={`${simulation.after.linked_applicant_count} connected`} detail={`${simulation.created_entities.length} newly introduced customers`} />
        <EvidenceCard icon={Building2} label="Dealer cluster" value={`${simulation.after.dealer_applications_2h} applications`} detail={`Within two hours · ${simulation.network.summary.dealer_id}`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
        <article className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <p className="eyebrow">Network analysis</p>
            <h2 className="panel-title">The relationships behind the transition</h2>
          </div>
          <div className="h-[520px]" aria-label="Simulated emerging risk network">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              fitView
              minZoom={0.4}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="#d7deea" gap={18} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </article>

        <aside className="panel bg-[var(--navy)] text-white">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--aqua)]">
            <ShieldAlert size={15} /> Explanation and action
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-[-.03em]">
            {simulation.recommended_action.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {simulation.recommended_action.rationale}
          </p>
          <div className="mt-6 divide-y divide-white/10">
            {simulation.explanations.slice(0, 5).map((signal, index) => (
              <div key={signal.code} className="flex gap-3 py-4 first:pt-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[10px] font-bold text-[var(--aqua)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-bold">{signal.code.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">{signal.message}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2 rounded-xl bg-emerald-400/10 p-3 text-[11px] leading-5 text-emerald-100">
            <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
            Scenario {simulation.scenario_id} is isolated from portfolio state.
          </div>
        </aside>
      </section>
    </div>
  );
}

function RiskStateCard({ stage, snapshot, customer }: { stage: string; snapshot: DemoRiskSnapshot; customer: string }) {
  const high = snapshot.risk_level === 'HIGH';
  return (
    <article className={`panel relative overflow-hidden ${high ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{stage}</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--navy)]">{customer}</h2>
        </div>
        <RiskBadge level={snapshot.risk_level} />
      </div>
      <div className="mt-7 flex items-end gap-3">
        <span className={`text-6xl font-bold tracking-[-.07em] ${high ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
          {snapshot.risk_score.toFixed(0)}
        </span>
        <span className="pb-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">/ 100 risk</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <StateFact label="Linked applicants" value={snapshot.linked_applicant_count} />
        <StateFact label="2-hour velocity" value={snapshot.application_velocity_2h} />
      </div>
    </article>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.055] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-white">{value}</p></div>;
}

function StateFact({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white/70 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div>;
}

function EvidenceCard({ icon: Icon, label, value, detail }: { icon: typeof Smartphone; label: string; value: string; detail: string }) {
  return <article className="panel"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]"><Icon size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div></div><p className="mt-4 truncate font-mono text-[10px] text-[var(--muted)]" title={detail}>{detail}</p></article>;
}

function mapDemoGraph(simulation: DemoSimulation): { nodes: Node[]; edges: Edge[] } {
  let applicantRow = 0;
  const nodes = simulation.network.nodes.map((item) => {
    const style = nodeStyle[item.role] ?? nodeStyle.applicant;
    const position = item.type === 'customer'
      ? { x: 80, y: 45 + applicantRow++ * 72 }
      : item.type === 'device'
        ? { x: 430, y: 130 }
        : { x: 430, y: 330 };
    return {
      id: item.id,
      position,
      data: { label: item.label },
      style: {
        width: 168,
        minHeight: 44,
        borderRadius: 13,
        border: `${item.is_focus ? 3 : 1.5}px solid ${style.border}`,
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 750,
        boxShadow: item.is_focus ? '0 12px 30px rgba(27,98,255,.22)' : '0 5px 16px rgba(17,31,55,.07)',
      },
    } satisfies Node;
  });
  const edges = simulation.network.edges.map((item) => ({
    id: item.id,
    source: item.source,
    target: item.target,
    label: item.type === 'uses_device' ? 'shared device' : 'same dealer',
    labelStyle: { fontSize: 8, fill: '#6f7b8f', fontWeight: 600 },
    style: { stroke: item.type === 'uses_device' ? '#7656df' : '#f3a62b', strokeWidth: 1.6 },
  } satisfies Edge));
  return { nodes, edges };
}
