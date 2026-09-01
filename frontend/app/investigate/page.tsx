'use client';

import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock3,
  CreditCard,
  Fingerprint,
  Landmark,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import {
  EmptyPanel,
  ErrorPanel,
  LoadingPanel,
  PageHeading,
  RiskBadge,
} from '../../components/ui';
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

  const profile = explanation?.borrower;
  const score = analysis?.risk_score ?? 0;
  const scoreColor =
    analysis?.risk_level === 'HIGH'
      ? '#ed4b5f'
      : analysis?.risk_level === 'MEDIUM'
        ? '#f3a62b'
        : '#0fb283';

  return (
    <AppShell activePath="/investigate">
      <div className="mx-auto max-w-[1500px]">
        <PageHeading
          eyebrow="Application investigation"
          title="Move from borrower to ecosystem."
          description="Enter an application ID to resolve its profile, connected evidence, temporal behavior, and recommended action."
        />

        <form
          onSubmit={investigate}
          className="panel mt-7 flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
        >
          <label htmlFor="application-id" className="sr-only">
            Application ID
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="application-id"
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              placeholder="Enter application ID, e.g. APP-S-005001"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-sm font-medium text-[var(--navy)] placeholder:text-slate-400 focus:border-blue-200 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !applicationId.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-6 text-sm font-semibold text-white shadow-[0_9px_24px_rgba(27,98,255,.2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Analyse ecosystem <ArrowRight size={15} />
          </button>
        </form>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Standard seed demo: try{' '}
          <button
            type="button"
            onClick={() => setApplicationId('APP-S-005001')}
            className="font-semibold text-[var(--blue)] underline-offset-2 hover:underline"
          >
            APP-S-005001
          </button>
        </p>

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Analysing application ecosystem" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : !analysis || !explanation ? (
            <EmptyPanel
              title="Start with an application"
              description="No score is guessed in the browser. Submit an application ID to run the versioned backend analysis."
            />
          ) : (
            <div className="space-y-4">
              <section className="grid gap-4 xl:grid-cols-[.72fr_1.35fr_.93fr]">
                <article className="panel flex flex-col items-center justify-center text-center">
                  <p className="eyebrow">Ecosystem risk</p>
                  <div
                    className="relative mt-5 grid h-44 w-44 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(${scoreColor} ${score}%, #edf1f6 ${score}% 100%)`,
                    }}
                    aria-label={`Risk score ${score} out of 100`}
                  >
                    <span className="absolute inset-[11px] rounded-full bg-white" />
                    <span className="relative">
                      <span className="block text-5xl font-bold tracking-[-.06em] text-[var(--navy)]">
                        {score.toFixed(0)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">
                        out of 100
                      </span>
                    </span>
                  </div>
                  <div className="mt-4">
                    <RiskBadge level={analysis.risk_level} />
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Analysis {analysis.analysis_id.slice(-8)}
                  </p>
                </article>

                <article className="panel">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow">Borrower profile</p>
                      <h2 className="panel-title">{profile.customer_id}</h2>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]">
                      <CircleUserRound size={20} />
                    </span>
                  </div>
                  <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                    <ProfileFact icon={CalendarDays} label="Age" value={`${profile.age} years`} />
                    <ProfileFact icon={Landmark} label="Annual income" value={inr.format(profile.annual_income_inr)} />
                    <ProfileFact icon={CreditCard} label="Credit score" value={String(profile.credit_score)} />
                    <ProfileFact icon={BadgeIndianRupee} label="Loan amount" value={inr.format(profile.loan_amount_inr)} />
                    <ProfileFact icon={Fingerprint} label="Loan type" value={profile.loan_type.replaceAll('_', ' ')} />
                    <ProfileFact icon={Network} label="Dealer" value={profile.dealer_id} />
                  </dl>
                  <Link
                    href={`/network?customer=${encodeURIComponent(profile.customer_id)}`}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[var(--blue)]"
                  >
                    Open connected network <ChevronRight size={14} />
                  </Link>
                </article>

                <article className="panel bg-[var(--navy)] text-white">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--aqua)]">
                    <ShieldCheck size={15} /> Recommended action
                  </div>
                  <h2 className="mt-5 text-2xl font-bold tracking-[-.03em]">
                    {analysis.recommended_action.label}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {analysis.recommended_action.rationale}
                  </p>
                  <div className="mt-7 border-t border-white/10 pt-5 text-xs text-slate-400">
                    <p className="flex items-center gap-2">
                      <Clock3 size={14} /> Analysed{' '}
                      {new Date(analysis.analysed_at).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-2 flex items-center gap-2">
                      <Sparkles size={14} /> Model{' '}
                      {analysis.versions.model ?? 'Explainable policy only'}
                    </p>
                  </div>
                </article>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
                <article className="panel">
                  <p className="eyebrow">Ranked evidence</p>
                  <h2 className="panel-title">Why this ecosystem is flagged</h2>
                  <div className="mt-5 divide-y divide-[var(--line)]">
                    {analysis.signals.map((signal, index) => (
                      <div key={signal.code} className="flex gap-4 py-4 first:pt-0">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-xs font-bold text-[var(--red)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-[var(--navy)]">
                              {signal.code.replaceAll('_', ' ')}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              {signal.severity}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            {signal.message}
                          </p>
                          {signal.entity_ids.length > 0 && (
                            <p className="mt-2 font-mono text-[10px] text-[var(--blue)]">
                              {signal.entity_ids.join(' · ')}
                            </p>
                          )}
                        </div>
                        <span className="ml-auto text-xs font-bold text-[var(--red)]">
                          +{signal.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel">
                  <p className="eyebrow">Evidence summary</p>
                  <h2 className="panel-title">Network + time</h2>
                  <dl className="mt-5 space-y-4">
                    <EvidenceFact label="Connected applicants" value={explanation.graph_evidence.connected_applicant_count} />
                    <EvidenceFact label="Cluster size" value={explanation.graph_evidence.cluster_size} />
                    <EvidenceFact label="Shared identity signals" value={explanation.graph_evidence.shared_identity_signal_count} />
                    <EvidenceFact label="2-hour velocity" value={explanation.temporal_evidence.application_velocity_2h} />
                    <EvidenceFact label="Linked in 24 hours" value={explanation.temporal_evidence.linked_applicants_24h} />
                  </dl>
                </article>
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-slate-50/70 p-3">
      <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        <Icon size={13} /> {label}
      </dt>
      <dd className="mt-2 text-sm font-bold capitalize text-[var(--navy)]">{value}</dd>
    </div>
  );
}

function EvidenceFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-bold text-[var(--navy)]">{value}</dd>
    </div>
  );
}
