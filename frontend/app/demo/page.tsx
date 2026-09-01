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
  Clock3,
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
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { IntelligenceJourney } from '../../components/intelligence-journey';
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
          eyebrow="Judge walkthrough · 3 minutes"
          title="Watch the decision change as hidden context appears."
          description="One live scenario explains the problem, the intelligence pipeline, the evidence, and the human action—without relying on a scripted score."
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPresentationMode((value) => !value)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-xs font-bold text-[var(--navy)] shadow-sm"
              >
                {presentationMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                {presentationMode ? 'Exit presentation view' : 'Presentation view'}
              </button>
              <button
                type="button"
                onClick={runSimulation}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-6 text-sm font-bold text-white shadow-[0_10px_30px_rgba(27,98,255,.25)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simulation ? <RefreshCw size={16} /> : <Play size={16} />}
                {simulation ? 'Run a fresh scenario' : 'Simulate Emerging Risk Ecosystem'}
              </button>
            </div>
          }
        />

        <PresentationCompass complete={Boolean(simulation)} />

        <section className="presentation-hero mt-5 px-6 py-7 text-white sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--aqua)]">
                <Sparkles size={14} /> Computed—not scripted
              </div>
              <h2 className="mt-4 max-w-xl text-2xl font-bold tracking-[-.035em] sm:text-3xl">
                The borrower does not change. Our visibility does.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                First we see an individually plausible application. Then five connected applicants appear around the same device and dealer in under two hours. The platform recomputes the decision from that evidence.
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
            <section className="panel">
              <div className="grid gap-5 border-b border-[var(--line)] pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.55fr)] lg:items-end">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--blue)]">
                    <GitCompareArrows size={15} /> What the click will prove
                  </div>
                  <h2 className="mt-3 text-xl font-bold tracking-[-.025em] text-[var(--navy)]">One application. Six intelligence stages. One explainable decision.</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Every stage below runs on the backend. The interface reveals the outputs in the same order an analyst would reason through them.</p>
                </div>
                <PresenterCue text="Ask the judges: would an individual credit score reveal coordinated behaviour that has not happened yet?" />
              </div>
              <div className="mt-5"><IntelligenceJourney /></div>
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
                <GraphLegend color="#1b62ff" label="Applicants" />
                <GraphLegend color="#7656df" label="Shared device" />
                <GraphLegend color="#f3a62b" label="Dealer" />
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

      <section className="overflow-hidden rounded-[22px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--blue)] text-white shadow-[0_10px_26px_rgba(27,98,255,.22)]"><Lightbulb size={21} /></span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[var(--blue)]">The conclusion for judges</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-.025em] text-[var(--navy)]">JaalDrishti does not replace lending decisions—it reveals the ecosystem those decisions were missing.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">The score moved because verifiable network and temporal evidence appeared. The analyst can inspect every signal, understand the threshold, and authorize the final action.</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white/80 px-5 py-4 text-center">
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
    { label: 'Problem', detail: 'Individual checks miss coordination' },
    { label: 'Detection', detail: 'Graph + time expose emergence' },
    { label: 'Decision', detail: 'Evidence leads to human action' },
  ];
  return (
    <section className="mt-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:grid-cols-3" aria-label="Presentation roadmap">
      {beats.map((beat, index) => (
        <div key={beat.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${complete || index === 0 ? 'bg-blue-50' : 'bg-slate-50'}`}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${complete ? 'bg-[var(--green)] text-white' : index === 0 ? 'bg-[var(--blue)] text-white' : 'bg-white text-slate-400'}`}>{complete ? '✓' : index + 1}</span>
          <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--navy)]">{beat.label}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{beat.detail}</p></div>
        </div>
      ))}
    </section>
  );
}

function PresenterCue({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-amber-700">Presenter cue</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-amber-950">“{text}”</p>
    </div>
  );
}

function ProcessReveal({ simulation }: { simulation: DemoSimulation }) {
  const stages = [
    { icon: Database, label: 'Records created', value: `${simulation.network.summary.applicant_count} applications`, note: 'Synthetic, isolated scenario' },
    { icon: Fingerprint, label: 'Identity resolved', value: '2 shared entities', note: 'Device and dealer evidence' },
    { icon: Network, label: 'Graph assembled', value: `${simulation.network.nodes.length} nodes`, note: `${simulation.network.edges.length} evidence links` },
    { icon: Clock3, label: 'Time evaluated', value: `${simulation.after.application_velocity_2h} in 2h`, note: 'Rapid coordinated burst' },
    { icon: BrainCircuit, label: 'Risk explained', value: `${simulation.explanations.length} signals`, note: `Final score ${simulation.after.risk_score.toFixed(2)}` },
    { icon: UserCheck, label: 'Action routed', value: 'Human review', note: simulation.recommended_action.label },
  ];
  return (
    <section className="panel">
      <div className="grid gap-4 border-b border-[var(--line)] pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.5fr)] lg:items-end">
        <div>
          <p className="eyebrow">What the system just computed</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-.025em] text-[var(--navy)]">The complete intelligence path, with live outputs</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">No UI score is hardcoded. Each result below comes from the isolated backend scenario.</p>
        </div>
        <PresenterCue text="The borrower stayed the same. Only the network and time context became visible." />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {stages.map(({ icon: Icon, label, value, note }, index) => (
          <article key={label} className="relative rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4">
            <div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[var(--blue)] shadow-sm"><Icon size={17} /></span><span className="text-[9px] font-extrabold text-slate-400">0{index + 1}</span></div>
            <p className="mt-4 text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label}</p>
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

function HeroFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.055] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-white">{value}</p></div>;
}

function StateFact({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white/70 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div>;
}

function EvidenceCard({ icon: Icon, label, value, detail, why }: { icon: typeof Smartphone; label: string; value: string; detail: string; why: string }) {
  return <article className="panel"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]"><Icon size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-base font-bold text-[var(--navy)]">{value}</p></div></div><p className="mt-4 text-xs leading-5 text-[var(--ink)]">{why}</p><p className="mt-3 truncate border-t border-[var(--line)] pt-3 font-mono text-[10px] text-[var(--muted)]" title={detail}>{detail}</p></article>;
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
