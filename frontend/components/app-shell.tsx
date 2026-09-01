'use client';

import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  FlaskConical,
  LayoutDashboard,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { API_BASE_URL } from '../lib/api';

const navigation = [
  { href: '/', label: 'Live Monitor', icon: LayoutDashboard },
  { href: '/investigate', label: 'Investigations', icon: Search },
  { href: '/network', label: 'Network Intelligence', icon: Network },
  { href: '/dealers', label: 'Dealer Intelligence', icon: Building2 },
  { href: '/analytics', label: 'Portfolio Insights', icon: BarChart3 },
  { href: '/demo', label: 'Simulation Lab', icon: FlaskConical },
];

interface AppShellProps {
  activePath: string;
  children: ReactNode;
  presentationMode?: boolean;
}

export function AppShell({ activePath, children, presentationMode = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {!presentationMode && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--line)] bg-white lg:flex">
          <div className="border-b border-[var(--line)] px-5 py-5">
            <Link href="/" className="flex items-center gap-3" aria-label="TVS JaalDrishti home">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--navy)] text-white">
                <ShieldCheck size={19} strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-[var(--blue)]">TVS Credit</span>
                <span className="mt-0.5 block text-[15px] font-semibold tracking-[-.02em] text-[var(--navy)]">JaalDrishti</span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-5" aria-label="Primary navigation">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Workspace</p>
            <div className="space-y-1">
              {navigation.map(({ href, label, icon: Icon }) => {
                const active = href === activePath;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-[var(--blue)]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[var(--navy)]'
                    }`}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                    <span>{label}</span>
                    {active && <ChevronRight className="ml-auto" size={14} />}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-[var(--line)] p-4">
            <div className="rounded-md border border-[var(--line)] bg-[var(--subtle)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">System status</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--green)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" /> Live
                </span>
              </div>
              <a href={`${API_BASE_URL}/health`} target="_blank" rel="noreferrer" className="mt-2 block text-[11px] text-slate-500 hover:text-[var(--blue)]">
                API and intelligence services operational
              </a>
            </div>
          </div>
        </aside>
      )}

      <div className={presentationMode ? '' : 'lg:pl-60'}>
        {!presentationMode && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--line)] bg-white px-4 sm:px-6 lg:px-7">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--navy)] text-white"><ShieldCheck size={17} /></span>
              <span className="text-sm font-semibold text-[var(--navy)]">JaalDrishti</span>
            </div>

            <label className="relative hidden max-w-md flex-1 md:block">
              <span className="sr-only">Search workspace</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search application, customer, dealer or device"
                className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--subtle)] pl-9 pr-3 text-xs text-[var(--ink)] placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[11px] font-medium text-slate-600 xl:flex">
                <CalendarDays size={14} /> 01 Aug – 31 Aug 2026
              </div>
              <div className="hidden items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[.08em] text-[var(--green)] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" /> Live stream active
              </div>
              <button type="button" className="relative grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-white text-slate-500" aria-label="Notifications">
                <Bell size={16} />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--red)]" />
              </button>
              <div className="flex items-center gap-2 border-l border-[var(--line)] pl-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600"><CircleUserRound size={17} /></span>
                <div className="hidden leading-tight xl:block"><p className="text-[11px] font-semibold text-[var(--navy)]">Risk Operations</p><p className="text-[10px] text-[var(--muted)]">Analyst workspace</p></div>
              </div>
            </div>
          </header>
        )}

        <main className={`px-4 pb-24 sm:px-6 lg:px-7 lg:pb-8 ${presentationMode ? 'pt-5' : 'pt-6'}`}>{children}</main>

        {!presentationMode && (
          <nav className="fixed inset-x-3 bottom-3 z-40 flex overflow-x-auto rounded-lg border border-[var(--line)] bg-white p-1 shadow-lg lg:hidden" aria-label="Mobile navigation">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-label={label} aria-current={href === activePath ? 'page' : undefined} className={`flex min-w-[82px] flex-1 flex-col items-center gap-1 rounded-md py-2 text-[9px] font-medium ${href === activePath ? 'bg-blue-50 text-[var(--blue)]' : 'text-slate-500'}`}>
                <Icon size={15} /><span>{label.split(' ')[0]}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
