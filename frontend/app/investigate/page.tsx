'use client';

import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  CreditCard,
  Fingerprint,
  Landmark,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading, RiskBadge } from '../../components/ui';
import { analyseApplication, getExplanation } from '../../lib/api';
import type { Analysis, Explanation } from '../../lib/types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function InvestigationPage() {
  const [applicationId, setApplicationId] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function investigate(event: FormEvent, forceRefresh = false) {
    event.preventDefault();
    const normalized = applicationId.trim();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const nextAnalysis = await analyseApplication(normalized, forceRefresh);
      const nextExplanation = await getExplanation(normalized);
      setAnalysis(nextAnalysis);
      setExplanation(nextExplanation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to analyse application.');
      setAnalysis(null);
      setExplanation(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell activePath="/investigate">
      <div className="mx-auto max-w-[1600px]">
        <PageHeading
          eyebrow="Case management"
          title="Investigation Workspace"
          description="Compare the individual borrower profile with connected ecosystem evidence and reach an explainable review action."
        />

        <form onSubmit={investigate} className="mt-5 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center">
          <label htmlFor="application-id" className="sr-only">Application ID</label>
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="application-id" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="Enter application ID, e.g. APP-S-005001" autoComplete="off" className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] pl-9 pr-3 text-xs font-medium text-[var(--navy)] placeholder:text-slate-400 focus:border-green-400 focus:bg-white" />
          </div>
          <button type="submit" disabled={loading || !applicationId.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--blue)] px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Analyse ecosystem <ArrowRight size={14} /></button>
        </form>
        <p className="mt-2 text-[11px] text-[var(--muted)]">Standard seed demo: try <button type="button" onClick={() => setApplicationId('APP-S-005001')} className="font-semibold text-[var(--blue)] hover:underline">APP-S-005001</button></p>

        <div className="mt-5">
          {loading ? <LoadingPanel label="Analysing application ecosystem" /> : error ? <ErrorPanel message={error} /> : !analysis || !explanation ? (
            <EmptyPanel title="Start with an application" description="No score is guessed in the browser. Submit an application ID to run the versioned backend analysis." />
          ) : <InvestigationResult analysis={analysis} explanation={explanation} />}
        </div>
      </div>
    </AppShell>
  );
}

function InvestigationResult({ analysis, explanation }: { analysis: Analysis; explanation: Explanation }) {
  const profile = explanation.borrower;
  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#eef7f2] text-[var(--blue)]"><Fingerprint size={17} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Investigation ID</p><p className="mt-0.5 font-mono text-sm font-semibold text-[var(--navy)]">{analysis.analysis_id}</p></div></div>
        <div className="flex items-center gap-3"><span className="text-[11px] text-[var(--muted)]">Application {analysis.application_id}</span><span className="rounded bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700">Requires Review</span></div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(280px,.8fr)_minmax(420px,1.15fr)_minmax(320px,.88fr)]">
        <article className="rounded-lg border border-[var(--line)] bg-white">
          <SectionHeader title="Customer profile" detail="Individual borrower view" />
          <div className="p-5">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-5"><span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600"><CircleUserRound size={20} /></span><div><h2 className="font-mono text-sm font-semibold text-[var(--navy)]">{profile.customer_id}</h2><p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--green)]"><CheckCircle2 size={12} /> Synthetic identity record available</p></div></div>
            <dl className="mt-4 divide-y divide-[var(--line)]">
              <ProfileFact icon={CalendarDays} label="Age" value={`${profile.age} years`} />
              <ProfileFact icon={Landmark} label="Annual income" value={inr.format(profile.annual_income_inr)} />
              <ProfileFact icon={CreditCard} label="Credit score" value={String(profile.credit_score)} />
              <ProfileFact icon={BadgeIndianRupee} label="Loan amount" value={inr.format(profile.loan_amount_inr)} />
              <ProfileFact icon={Fingerprint} label="Loan type" value={profile.loan_type.replaceAll('_', ' ')} />
              <ProfileFact icon={Network} label="Originating dealer" value={profile.dealer_id} />
            </dl>
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-4"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-green-700">Individual-only view</p><p className="mt-2 text-sm font-semibold text-[var(--navy)]">No obvious profile anomaly</p><p className="mt-1 text-[11px] leading-5 text-slate-600">The borrower attributes remain individually plausible. The material risk is found in connected behaviour.</p></div>
          </div>
        </article>

        <article className="rounded-lg border border-[var(--line)] bg-white">
          <SectionHeader title="Ecosystem analysis" detail="Graph + temporal intelligence" />
          <div className="p-5">
            <div className="flex items-end justify-between gap-5 border-b border-[var(--line)] pb-5">
              <div aria-label={`Risk score ${analysis.risk_score} out of 100`}><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Ecosystem risk</p><div className="mt-1 flex items-end gap-2"><span className="text-5xl font-semibold tracking-[-.06em] text-[var(--red)]">{analysis.risk_score.toFixed(0)}</span><span className="pb-1.5 text-xs text-[var(--muted)]">/ 100</span></div></div>
              <RiskBadge level={analysis.risk_level} />
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--line)] rounded-md border border-[var(--line)] bg-[var(--subtle)] py-3 text-center"><Metric label="Connected entities" value={explanation.graph_evidence.cluster_size} /><Metric label="Related applicants" value={explanation.graph_evidence.connected_applicant_count} /><Metric label="Shared signals" value={explanation.graph_evidence.shared_identity_signal_count} /></div>
            <div className="mt-6"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Risk evolution</p><div className="mt-4 space-y-0"><TimelineStep icon={CircleUserRound} label="Application received" detail="Individual borrower indicators recorded" /><TimelineStep icon={Fingerprint} label="Identity relationship found" detail={`${explanation.graph_evidence.shared_identity_signal_count} shared identity signals`} /><TimelineStep icon={Clock3} label="Temporal pattern evaluated" detail={`${explanation.temporal_evidence.application_velocity_2h} linked applications inside two hours`} /><TimelineStep icon={ShieldCheck} label="Risk threshold crossed" detail={`${analysis.risk_level} ecosystem · ${analysis.risk_score.toFixed(0)} risk score`} last /></div></div>
            <Link href={`/network?customer=${encodeURIComponent(profile.customer_id)}`} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)]">Open connected network <ChevronRight size={13} /></Link>
          </div>
        </article>

        <aside className="rounded-lg border border-[var(--line)] bg-white">
          <SectionHeader title="Why was this flagged?" detail={`${analysis.signals.length} evidence signals`} />
          <div className="divide-y divide-[var(--line)]">
            {analysis.signals.map((signal, index) => <div key={signal.code} className="p-4"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-red-50 text-[10px] font-bold text-[var(--red)]">{index + 1}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-semibold text-[var(--navy)]">{signal.code.replaceAll('_', ' ')}</p><span className="text-[9px] font-semibold text-[var(--red)]">+{signal.points}</span></div><p className="mt-1.5 text-[11px] leading-5 text-[var(--muted)]">{signal.message}</p>{signal.entity_ids.length > 0 && <p className="mt-2 truncate font-mono text-[9px] text-[var(--blue)]">{signal.entity_ids.join(' · ')}</p>}</div></div></div>)}
          </div>
          <div className="m-4 rounded-md bg-[var(--navy)] p-4 text-white"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#bdebd0]">Recommended action</p><h2 className="mt-2 text-base font-semibold">{analysis.recommended_action.label}</h2><p className="mt-2 text-[11px] leading-5 text-slate-300">{analysis.recommended_action.rationale}</p><div className="mt-4 border-t border-white/10 pt-3 text-[10px] text-slate-400">Human authorization required · Policy {analysis.versions.risk_policy}</div></div>
        </aside>
      </section>
    </div>
  );
}

function SectionHeader({ title, detail }: { title: string; detail: string }) { return <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><h2 className="text-sm font-semibold text-[var(--navy)]">{title}</h2><span className="text-[10px] text-[var(--muted)]">{detail}</span></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="px-2"><p className="text-lg font-semibold text-[var(--navy)]">{value}</p><p className="mt-1 text-[9px] text-[var(--muted)]">{label}</p></div>; }
function ProfileFact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex items-center justify-between gap-3 py-3"><dt className="flex items-center gap-2 text-[11px] text-[var(--muted)]"><Icon size={13} />{label}</dt><dd className="text-right text-xs font-semibold capitalize text-[var(--navy)]">{value}</dd></div>; }
function TimelineStep({ icon: Icon, label, detail, last = false }: { icon: typeof CircleUserRound; label: string; detail: string; last?: boolean }) { return <div className="relative flex gap-3 pb-5 last:pb-0"><div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--blue)]"><Icon size={13} /></div>{!last && <span className="absolute left-[13px] top-7 h-full w-px bg-[var(--line)]" />}<div><p className="text-[11px] font-semibold text-[var(--navy)]">{label}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{detail}</p></div></div>; }
