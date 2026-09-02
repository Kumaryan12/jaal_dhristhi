'use client';

import { CalendarRange, Filter, IndianRupee, ShieldAlert } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppShell } from '../../components/app-shell';
import { ErrorPanel, LoadingPanel, PageHeading } from '../../components/ui';
import { getAnalytics } from '../../lib/api';
import type { Analytics } from '../../lib/types';

const riskColors = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626' };
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: 'compact',
});

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAnalytics(undefined, controller.signal)
      .then(setAnalytics)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load analytics.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function applyFilters(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setAnalytics(
        await getAnalytics({
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to filter analytics.');
    } finally {
      setLoading(false);
    }
  }

  const daily = useMemo(
    () =>
      analytics?.daily_activity.map((item) => ({
        ...item,
        label: new Date(`${item.date}T00:00:00Z`).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
      })) ?? [],
    [analytics],
  );
  const total =
    analytics?.risk_distribution.reduce((sum, item) => sum + item.count, 0) ?? 0;

  return (
    <AppShell activePath="/analytics">
      <div className="mx-auto max-w-[1600px]">
        <PageHeading
          eyebrow="Portfolio analysis"
          title="Portfolio Insights"
          description="Review risk distribution, dealer concentration, temporal movement, and exposure using bounded server-side data."
          actions={
            analytics && (
              <span className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted)]">
                <CalendarRange size={14} /> {analytics.from_date} — {analytics.to_date}
              </span>
            )
          }
        />

        <form
          onSubmit={applyFilters}
          className="mt-5 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] px-3 text-xs font-medium normal-case tracking-normal focus:border-green-400 focus:bg-white"
            />
          </label>
          <label className="flex-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] px-3 text-xs font-medium normal-case tracking-normal focus:border-green-400 focus:bg-white"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--navy)] px-5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Filter size={14} /> Apply range
          </button>
        </form>

        <div className="mt-6">
          {loading ? (
            <LoadingPanel label="Computing portfolio analytics" />
          ) : error ? (
            <ErrorPanel message={error} />
          ) : analytics ? (
            <div className="space-y-4">
              <section className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
                <article className="panel min-h-[380px]">
                  <p className="eyebrow">Risk distribution</p>
                  <h2 className="panel-title">Review band mix</h2>
                  <div className="relative mt-5 h-[230px]" aria-label="Risk distribution donut chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.risk_distribution}
                          dataKey="count"
                          nameKey="risk_level"
                          innerRadius={72}
                          outerRadius={98}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {analytics.risk_distribution.map((item) => (
                            <Cell key={item.risk_level} fill={riskColors[item.risk_level]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="text-3xl font-bold tracking-tight text-[var(--navy)]">
                          {total.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Applications
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {analytics.risk_distribution.map((item) => (
                      <div key={item.risk_level} className="rounded-md border border-[var(--line)] bg-[var(--subtle)] p-2.5 text-center">
                        <span className="mx-auto block h-2 w-2 rounded-full" style={{ background: riskColors[item.risk_level] }} />
                        <p className="mt-2 text-[9px] font-bold text-[var(--muted)]">{item.risk_level}</p>
                        <p className="mt-0.5 text-sm font-bold text-[var(--navy)]">{item.count.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel min-h-[380px]">
                  <p className="eyebrow">Dealer concentration</p>
                  <h2 className="panel-title">Top clusters by high-risk volume</h2>
                  <div className="mt-6 h-[295px]" aria-label="Dealer cluster bar chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.top_dealer_clusters.slice(0, 8)} layout="vertical" margin={{ left: 15, right: 15 }}>
                        <CartesianGrid stroke="#dce8e1" strokeDasharray="3 5" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#7c8799', fontSize: 10 }} />
                        <YAxis type="category" dataKey="dealer_id" axisLine={false} tickLine={false} width={78} tick={{ fill: '#536176', fontSize: 10, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: '#f5f7fa' }} />
                        <Bar dataKey="application_count" name="Applications" fill="#acd6bd" radius={[0, 2, 2, 0]} />
                        <Bar dataKey="high_risk_count" name="High risk" fill="#dc2626" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </section>

              <article className="panel min-h-[410px]">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="eyebrow">Temporal movement</p>
                    <h2 className="panel-title">Daily applications and high-risk activity</h2>
                  </div>
                  <div className="flex gap-4 text-[10px] font-semibold text-[var(--muted)]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--blue)]" /> Applications</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--red)]" /> High risk</span>
                  </div>
                </div>
                <div className="mt-6 h-[310px]" aria-label="Daily portfolio activity chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily} margin={{ left: -20, right: 5 }}>
                      <CartesianGrid stroke="#dce8e1" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={45} tick={{ fill: '#7c8799', fontSize: 9 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7c8799', fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="application_count" name="Applications" stroke="#174c82" fill="#e7f3ec" fillOpacity={0.7} strokeWidth={2} />
                      <Area type="monotone" dataKey="high_risk_count" name="High risk" stroke="#dc2626" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="panel overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                  <div>
                    <p className="eyebrow">Exposure table</p>
                    <h2 className="panel-title">Dealer review queue</h2>
                  </div>
                  <ShieldAlert className="text-[var(--red)]" size={19} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      <tr>
                        <th className="px-5 py-3">Dealer</th>
                        <th className="px-5 py-3">Applications</th>
                        <th className="px-5 py-3">High risk</th>
                        <th className="px-5 py-3">High-risk rate</th>
                        <th className="px-5 py-3 text-right">Exposure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {analytics.top_dealer_clusters.map((dealer) => (
                        <tr key={dealer.dealer_id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5 font-mono font-semibold text-[var(--navy)]">{dealer.dealer_id}</td>
                          <td className="px-5 py-3.5">{dealer.application_count}</td>
                          <td className="px-5 py-3.5 font-bold text-[var(--red)]">{dealer.high_risk_count}</td>
                          <td className="px-5 py-3.5">{((dealer.high_risk_count / dealer.application_count) * 100).toFixed(1)}%</td>
                          <td className="px-5 py-3.5 text-right font-semibold"><span className="inline-flex items-center"><IndianRupee size={11} />{inr.format(dealer.total_exposure_inr).replace('₹', '')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
