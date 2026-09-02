'use client';

import { AlertTriangle, ArrowUpRight, Building2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading } from '../../components/ui';
import { getAnalytics } from '../../lib/api';
import type { Analytics, DealerClusterItem } from '../../lib/types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: 'compact',
});

export default function DealerIntelligencePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAnalytics(undefined, controller.signal)
      .then((result) => {
        setAnalytics(result);
        setSelectedId(result.top_dealer_clusters[0]?.dealer_id ?? null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load dealer intelligence.');
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => analytics?.top_dealer_clusters.find((dealer) => dealer.dealer_id === selectedId) ?? null,
    [analytics, selectedId],
  );

  return (
    <AppShell activePath="/dealers">
      <div className="mx-auto max-w-[1600px]">
        <PageHeading
          eyebrow="Relationship analysis"
          title="Dealer Intelligence"
          description="Review application concentration, high-risk activity, and exposure across the dealer network."
        />

        <div className="mt-5">
          {error ? <ErrorPanel message={error} /> : !analytics ? <LoadingPanel label="Loading dealer intelligence" /> : (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <article className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--navy)]">Dealer risk register</h2><p className="mt-1 text-[11px] text-[var(--muted)]">Ranked by computed portfolio exposure</p></div><span className="text-[10px] text-[var(--muted)]">{analytics.top_dealer_clusters.length} monitored clusters</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-[var(--line)] bg-[var(--subtle)] text-[9px] font-semibold uppercase tracking-[.08em] text-[var(--muted)]"><tr><th className="px-5 py-3">Dealer</th><th className="px-4 py-3">Applications</th><th className="px-4 py-3">Risk index</th><th className="px-4 py-3">High-risk applications</th><th className="px-4 py-3">Exposure</th><th className="px-4 py-3">Status</th></tr></thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {analytics.top_dealer_clusters.map((dealer) => {
                        const index = riskIndex(dealer);
                        return <tr key={dealer.dealer_id} onClick={() => setSelectedId(dealer.dealer_id)} className={`cursor-pointer ${selectedId === dealer.dealer_id ? 'bg-[#eef7f2]/50' : 'hover:bg-slate-50'}`}><td className="px-5 py-3.5 font-mono font-semibold text-[var(--navy)]">{dealer.dealer_id}</td><td className="px-4 py-3.5">{dealer.application_count}</td><td className="px-4 py-3.5 font-semibold text-[var(--navy)]">{index.toFixed(1)}</td><td className="px-4 py-3.5 font-semibold text-[var(--red)]">{dealer.high_risk_count}</td><td className="px-4 py-3.5">{inr.format(dealer.total_exposure_inr)}</td><td className="px-4 py-3.5"><DealerStatus index={index} /></td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <aside className="rounded-lg border border-[var(--line)] bg-white p-5">
                {selected && <DealerDetails dealer={selected} />}
              </aside>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function DealerDetails({ dealer }: { dealer: DealerClusterItem }) {
  const index = riskIndex(dealer);
  return <><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-[#eef7f2] text-[var(--blue)]"><Building2 size={17} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">Selected dealer</p><h2 className="mt-0.5 font-mono text-sm font-semibold text-[var(--navy)]">{dealer.dealer_id}</h2></div></div><dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]"><DealerFact label="Applications" value={String(dealer.application_count)} /><DealerFact label="Risk index" value={`${index.toFixed(1)} / 100`} /><DealerFact label="High-risk activity" value={String(dealer.high_risk_count)} /><DealerFact label="Exposure" value={inr.format(dealer.total_exposure_inr)} /></dl><div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-amber-700"><AlertTriangle size={13} /> Investigation evidence</p><p className="mt-2 text-xs leading-5 text-amber-950">High-risk concentration is computed from applications connected to this dealer. Review customer and identity relationships before action.</p></div><a href="/network" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--blue)]">Open network intelligence <ArrowUpRight size={13} /></a></>;
}

function DealerFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-3"><dt className="text-[11px] text-[var(--muted)]">{label}</dt><dd className="text-xs font-semibold text-[var(--navy)]">{value}</dd></div>;
}

function DealerStatus({ index }: { index: number }) {
  const elevated = index >= 20;
  return <span className={`inline-flex rounded px-2 py-1 text-[9px] font-semibold ${elevated ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{elevated ? 'Requires review' : 'Monitor'}</span>;
}

function riskIndex(dealer: DealerClusterItem) {
  return dealer.application_count ? (dealer.high_risk_count / dealer.application_count) * 100 : 0;
}
