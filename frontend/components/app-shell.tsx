'use client';

import {
  Activity,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { API_BASE_URL } from '../lib/api';

const navigation = [
  { href: '/', label: 'Executive overview', icon: LayoutDashboard },
  { href: '/investigate', label: 'Investigate', icon: Search },
  { href: '/network', label: 'Network explorer', icon: Network },
  { href: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { href: '/demo', label: 'Judge walkthrough', icon: Sparkles },
];

interface AppShellProps {
  activePath: string;
  children: ReactNode;
}

export function AppShell({ activePath, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-[var(--navy)] px-4 py-5 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2" aria-label="JaalDrishti home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--blue)] shadow-[0_8px_28px_rgba(27,98,255,.35)]">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight">JaalDrishti</span>
            <span className="block text-[10px] font-medium uppercase tracking-[.14em] text-slate-400">
              Ecosystem intelligence
            </span>
          </span>
        </Link>

        <nav className="mt-9 space-y-1" aria-label="Primary navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === activePath;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--aqua)]'
                    : 'text-slate-400 hover:bg-white/[.06] hover:text-white'
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {active && <ChevronRight className="ml-auto text-[var(--aqua)]" size={15} />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.045] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Activity size={14} className="text-[var(--aqua)]" />
            Decision-support layer
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Network evidence supports analyst review. Final credit action remains human-authorized.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--navy)] text-white">
              <ShieldCheck size={20} />
            </span>
            <span className="text-sm font-bold">JaalDrishti</span>
          </div>
          <div className="hidden items-center gap-2 text-xs text-[var(--muted)] lg:flex">
            <span className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_0_4px_rgba(15,178,131,.12)]" />
            Live synthetic intelligence · Explainable by design
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] text-[var(--muted)]"
              aria-label="Open API documentation"
            >
              <CircleHelp size={17} />
            </a>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold">Risk Operations</p>
              <p className="text-[11px] text-[var(--muted)]">Analyst workspace</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--navy)] text-xs font-bold text-white">RO</span>
          </div>
        </header>

        <main className="px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pb-10">{children}</main>

        <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/70 bg-[var(--navy)] p-1.5 shadow-2xl lg:hidden" aria-label="Mobile navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-label={label} aria-current={href === activePath ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${href === activePath ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
              <Icon size={17} />
              <span>{label.split(' ')[0]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
