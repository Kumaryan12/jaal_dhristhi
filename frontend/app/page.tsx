'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  IndianRupee,
  Network,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppShell } from '../components/app-shell';
import { getAnalytics, getDashboardSummary } from '../lib/api';
import type { Analytics, DashboardSummary } from '../lib/types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  notation: 'compact',
});
const number = new Intl.NumberFormat('en-IN');

export default function ExecutiveDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getDashboardSummary(controller.signal),
      getAnalytics(undefined, controller.signal),
    ])
      .then(([nextSummary, nextAnalytics]) => {
        setSummary(nextSummary);
        setAnalytics(nextAnalytics);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load intelligence.',
          );
        }
      });
    return () => controller.abort();
  }, [refreshKey]);

  const trend = useMemo(() => {
    if (!analytics) return [];
    return analytics.daily_activity.slice(-45).map((item) => ({
      ...item,
      label: new Date(`${item.date}T00:00:00Z`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
    }));
  }, [analytics]);

  const metrics = [
    {
      label: 'Total applications',
      value: summary ? number.format(summary.total_applications) : '—',
      note: 'Current portfolio snapshot',
      icon: ArrowUpRight,
      tone: 'blue',
    },
    {
      label: 'Detected networks',
      value: summary ? number.format(summary.detected_networks) : '—',
      note: 'Connected ecosystems',
      icon: Network,
      tone: 'violet',
    },
    {
      label: 'High-risk ecosystems',
      value: summary ? number.format(summary.high_risk_ecosystems) : '—',
      note: 'Enhanced verification',
      icon: ShieldAlert,
      tone: 'red',
    },
    {
      label: 'Potential exposure',
      value: summary ? inr.format(summary.potential_exposure) : '—',
      note: 'Medium + high review band',
      icon: IndianRupee,
      tone: 'green',
    },
  ];

  return (
    <AppShell activePath="/">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[var(--blue)]">
              <span className="h-px w-7 bg-[var(--blue)]" /> Portfolio
              intelligence
            </div>
            <h1 className="text-[clamp(1.75rem,3vw,2.65rem)] font-bold tracking-[-.035em] text-[var(--navy)]">
              See the network before the loss.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              A live view of connected lending activity, emerging ecosystems,
              and review exposure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRefreshKey((value) => value + 1);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-xs font-semibold shadow-sm"
            >
              <RefreshCw size={14} /> Refresh data
            </button>
            <Link
              href="/investigate"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--blue)] px-4 text-xs font-semibold text-white shadow-[0_9px_24px_rgba(27,98,255,.22)]"
            >
              Investigate <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {error && (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            <div>
              <p className="font-semibold">Intelligence service needs attention</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                {error} Start the Phase 7 API and generate demo data, then
                refresh.
              </p>
            </div>
          </div>
        )}

        <section
          className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Portfolio metrics"
        >
          {metrics.map(({ label, value, note, icon: Icon, tone }) => (
            <article key={label} className="metric-card">
              <div className={`metric-icon metric-icon-${tone}`}>
                <Icon size={17} />
              </div>
              <p className="mt-5 text-xs font-semibold text-[var(--muted)]">
                {label}
              </p>
              <p className="mt-1 text-[1.85rem] font-bold tracking-[-.04em] text-[var(--navy)]">
                {value}
              </p>
              <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] text-slate-500">
                {note}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
          <article className="panel min-h-[385px]">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Emerging activity</p>
                <h2 className="panel-title">
                  Application and high-risk trend
                </h2>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Last 45 active days
              </span>
            </div>
            <div
              className="mt-7 h-[285px]"
              aria-label="Application activity chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ left: -20, right: 4, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="applicationFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#1b62ff"
                        stopOpacity={0.26}
                      />
                      <stop
                        offset="100%"
                        stopColor="#1b62ff"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#e8edf4"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={38}
                    tick={{ fill: '#7c8799', fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7c8799', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      border: '1px solid #e1e7ef',
                      borderRadius: 12,
                      boxShadow: '0 12px 32px rgba(17,31,55,.12)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="application_count"
                    name="Applications"
                    stroke="#1b62ff"
                    strokeWidth={2.4}
                    fill="url(#applicationFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="high_risk_count"
                    name="High risk"
                    stroke="#ed4b5f"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">Risk mix</p>
            <h2 className="panel-title">Portfolio review bands</h2>
            <div className="mt-7 space-y-5">
              {analytics?.risk_distribution.map((item) => {
                const total = analytics.risk_distribution.reduce(
                  (sum, row) => sum + row.count,
                  0,
                );
                const percent = total ? (item.count / total) * 100 : 0;
                return (
                  <div key={item.risk_level}>
                    <div className="mb-2 flex items-end justify-between">
                      <span
                        className={`risk-label risk-${item.risk_level.toLowerCase()}`}
                      >
                        {item.risk_level}
                      </span>
                      <span className="text-sm font-bold text-[var(--navy)]">
                        {number.format(item.count)}{' '}
                        <span className="text-[10px] font-medium text-[var(--muted)]">
                          {percent.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full risk-bar-${item.risk_level.toLowerCase()}`}
                        style={{ width: `${Math.max(percent, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 rounded-2xl bg-[var(--navy)] p-5 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldAlert size={15} className="text-[var(--aqua)]" />
                Analyst attention
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight">
                {summary
                  ? number.format(summary.high_risk_ecosystems)
                  : '—'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                High-risk connected ecosystems require enhanced verification.
              </p>
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
