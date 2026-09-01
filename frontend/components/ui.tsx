import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RiskLevel } from '../lib/types';

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-.03em] text-[var(--navy)]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk-label risk-${level.toLowerCase()}`}>{level}</span>
  );
}

export function LoadingPanel({ label = 'Loading intelligence' }: { label?: string }) {
  return (
    <div
      className="panel grid min-h-[260px] place-items-center text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <LoaderCircle
          className="mx-auto animate-spin text-[var(--blue)]"
          size={26}
        />
        <p className="mt-3 text-sm font-semibold text-[var(--navy)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Resolving connected evidence and temporal signals.
        </p>
      </div>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="panel border-red-200 bg-red-50" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 shrink-0 text-[var(--red)]" size={18} />
        <div>
          <p className="text-sm font-semibold text-red-950">Unable to load intelligence</p>
          <p className="mt-1 text-xs leading-5 text-red-800">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="panel grid min-h-[300px] place-items-center text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <SearchX size={21} />
        </span>
        <h2 className="mt-4 text-base font-bold text-[var(--navy)]">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}
