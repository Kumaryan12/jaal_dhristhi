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
  BrainCircuit,
  Building2,
  CheckCircle2,
  Database,
  Fingerprint,
  GitCompareArrows,
  Lightbulb,
  Maximize2,
  Minimize2,
  Network,
  Play,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from '../../components/ui';
import { simulateEmergingRisk } from '../../lib/api';
import type { DemoSimulation, DemoRiskSnapshot } from '../../lib/types';

const nodeStyle: Record<string, { background: string; border: string; color: string }> = {
  focus_customer: { background: '#0057a8', border: '#0057a8', color: '#fff' },
  applicant: { background: '#eff6ff', border: '#0057a8', color: '#0b1f3a' },
  shared_device: { background: '#f3f4f6', border: '#0b1f3a', color: '#0b1f3a' },
  dealer: { background: '#fffbeb', border: '#d97706', color: '#92400e' },
};

export default function DemoPage() {
  const [simulation, setSimulation] = useState<DemoSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);

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
    <AppShell activePath="/demo" presentationMode={presentationMode}>
      <div className="mx-auto max-w-[1500px]">
        <PageHeading
          eyebrow="Controlled scenario"
          title="Ecosystem Simulation"
          description="Watch how isolated applications evolve into connected risk patterns and an explainable review action."
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPresentationMode((value) => !value)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-xs font-semibold text-[var(--navy)]"
              >
                {presentationMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                {presentationMode ? 'Exit presentation view' : 'Presentation view'}
              </button>
              <button
                type="button"
                onClick={runSimulation}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--blue)] px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simulation ? <RefreshCw size={16} /> : <Play size={16} />}
                {simulation ? 'Run a fresh scenario' : 'Start Simulation'}
              </button>
            </div>
          }
        />

        <PresentationCompass complete={Boolean(simulation)} />

        <section className="mt-4 grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--blue)]">Computed backend scenario</p><h2 className="mt-1.5 text-base font-semibold text-[var(--navy)]">The borrower stays the same. The relationship context changes.</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Five connected applicants emerge around one shared device and dealer inside two hours.</p></div>
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] rounded-md border border-[var(--line)] bg-[var(--subtle)] py-2.5 text-center"><ScenarioFact label="Baseline" value="1 applicant" /><ScenarioFact label="Network" value="6 applicants" /><ScenarioFact label="Window" value="Under 2h" /></div>
        </section>

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Simulating the emerging ecosystem" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : !simulation ? (
            <section className="panel grid min-h-[240px] place-items-center text-center">
              <div className="max-w-xl"><span className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-[var(--blue)]"><GitCompareArrows size={19} /></span><h2 className="mt-4 text-lg font-semibold text-[var(--navy)]">Simulation ready</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Start the scenario to generate applications, resolve relationships, assemble the graph, evaluate temporal behaviour, and calculate the recommended action.</p></div>
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
      <ProcessReveal simulation={simulation} />

      <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <RiskStateCard stage="Before" context="Individual application view" snapshot={simulation.before} customer="Customer A" />
        <div className="grid place-items-center text-[var(--blue)]" aria-hidden="true">
          <span className="grid h-11 w-11 rotate-90 place-items-center rounded-full border border-blue-100 bg-blue-50 lg:rotate-0">
            <ArrowRight size={19} />
          </span>
        </div>
        <RiskStateCard stage="After network analysis" context="Connected ecosystem view" snapshot={simulation.after} customer="Customer A" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <EvidenceCard icon={Smartphone} label="Shared device" value={`${simulation.after.shared_device_applicant_count} applicants`} detail={simulation.network.summary.shared_device_id} why="A supposedly personal device is coordinating multiple identities." />
        <EvidenceCard icon={Users} label="Multiple applicants" value={`${simulation.after.linked_applicant_count} connected`} detail={`${simulation.created_entities.length} newly introduced customers`} why="The borrower is part of an ecosystem, not an isolated application." />
        <EvidenceCard icon={Building2} label="Dealer cluster" value={`${simulation.after.dealer_applications_2h} applications`} detail={`Within two hours · ${simulation.network.summary.dealer_id}`} why="Concentration and timing suggest organised origination activity." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
        <article className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Network analysis · the missing context</p>
                <h2 className="panel-title">The relationships behind the transition</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                <GraphLegend color="#0057a8" label="Applicants" />
                <GraphLegend color="#0b1f3a" label="Shared device" />
                <GraphLegend color="#d97706" label="Dealer" />
              </div>
            </div>
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
            <ShieldAlert size={15} /> Decision outcome · human-controlled
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
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white/10 text-[10px] font-bold text-blue-200">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-bold">{signal.code.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">{signal.message}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2 rounded-md bg-emerald-400/10 p-3 text-[11px] leading-5 text-emerald-100">
            <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
            Scenario {simulation.scenario_id} is isolated from portfolio state.
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50 p-5">
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--blue)] text-white"><Lightbulb size={18} /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--blue)]">Decision support outcome</p>
            <h2 className="mt-2 text-base font-semibold text-[var(--navy)]">JaalDrishti reveals the ecosystem context missing from the individual application.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The score moved because verifiable network and temporal evidence appeared. The analyst can inspect every signal, understand the threshold, and authorize the final action.</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-white px-5 py-4 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Outcome</p>
            <p className="mt-1 text-sm font-bold text-[var(--green)]">Earlier intervention</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PresentationCompass({ complete }: { complete: boolean }) {
  const beats = [
    { label: 'Application received', detail: 'Individual profile appears normal' },
    { label: 'Relationship discovered', detail: 'Shared identity evidence appears' },
    { label: 'Network formed', detail: 'Connected ecosystem becomes visible' },
    { label: 'Risk increased', detail: 'Graph and time cross thresholds' },
    { label: 'Action recommended', detail: 'Human review is requested' },
  ];
  return (
    <section className="mt-5 grid gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)] sm:grid-cols-5" aria-label="Simulation stages">
      {beats.map((beat, index) => (
        <div key={beat.label} className={`flex items-center gap-3 px-3 py-3 ${complete || index === 0 ? 'bg-blue-50' : 'bg-white'}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${complete ? 'bg-[var(--green)] text-white' : index === 0 ? 'bg-[var(--blue)] text-white' : 'bg-white text-slate-400'}`}>{complete ? '✓' : index + 1}</span>
          <div><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[var(--navy)]">{beat.label}</p><p className="mt-0.5 text-[9px] leading-4 text-[var(--muted)]">{beat.detail}</p></div>
        </div>
      ))}
    </section>
  );
}

function ProcessReveal({ simulation }: { simulation: DemoSimulation }) {
  const stages = [
    { icon: Database, label: 'Applications received', value: `${simulation.network.summary.applicant_count} applications`, note: 'Synthetic, isolated scenario' },
    { icon: Fingerprint, label: 'Relationship discovered', value: '2 shared entities', note: 'Device and dealer evidence' },
    { icon: Network, label: 'Network formed', value: `${simulation.network.nodes.length} nodes`, note: `${simulation.network.edges.length} evidence links` },
    { icon: BrainCircuit, label: 'Risk increased', value: `${simulation.after.risk_score.toFixed(2)} / 100`, note: `${simulation.explanations.length} explainable signals` },
    { icon: UserCheck, label: 'Action recommended', value: 'Human review', note: simulation.recommended_action.label },
  ];
  return (
    <section className="panel">
      <div className="border-b border-[var(--line)] pb-4">
          <p className="eyebrow">What the system just computed</p>
          <h2 className="mt-1.5 text-base font-semibold text-[var(--navy)]">Simulation processing trace</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">No UI score is hardcoded. Each result below comes from the isolated backend scenario.</p>
      </div>
      <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-5">
        {stages.map(({ icon: Icon, label, value, note }, index) => (
          <article key={label} className="relative bg-white p-4">
            <div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-[var(--blue)]"><Icon size={15} /></span><span className="text-[9px] font-semibold text-slate-400">0{index + 1}</span></div>
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-sm font-bold text-[var(--navy)]">{value}</p>
            <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">{note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RiskStateCard({ stage, context, snapshot, customer }: { stage: string; context: string; snapshot: DemoRiskSnapshot; customer: string }) {
  const high = snapshot.risk_level === 'HIGH';
  return (
    <article className={`panel relative overflow-hidden ${high ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{stage}</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--navy)]">{customer}</h2>
          <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{context}</p>
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

function ScenarioFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[110px] px-4"><p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-[11px] font-semibold text-[var(--navy)]">{value}</p></div>;
}

function StateFact({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-[var(--line)] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div>;
}

function EvidenceCard({ icon: Icon, label, value, detail, why }: { icon: typeof Smartphone; label: string; value: string; detail: string; why: string }) {
  return <article className="panel"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-[var(--blue)]"><Icon size={16} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div></div><p className="mt-4 text-xs leading-5 text-[var(--ink)]">{why}</p><p className="mt-3 truncate border-t border-[var(--line)] pt-3 font-mono text-[10px] text-[var(--muted)]" title={detail}>{detail}</p></article>;
}

function GraphLegend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>;
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
        borderRadius: item.type === 'customer' ? 999 : 6,
        border: `${item.is_focus ? 2 : 1}px solid ${style.border}`,
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 750,
        boxShadow: 'none',
      },
    } satisfies Node;
  });
  const edges = simulation.network.edges.map((item) => ({
    id: item.id,
    source: item.source,
    target: item.target,
    label: item.type === 'uses_device' ? 'shared device' : 'same dealer',
    labelStyle: { fontSize: 8, fill: '#6f7b8f', fontWeight: 600 },
    style: { stroke: item.type === 'uses_device' ? '#0b1f3a' : '#d97706', strokeWidth: 1.4 },
  } satisfies Edge));
  return { nodes, edges };
}
