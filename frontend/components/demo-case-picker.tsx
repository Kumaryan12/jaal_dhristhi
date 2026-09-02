import { BookOpenCheck } from 'lucide-react';

import type { DemoCasePreset } from '../lib/demo-cases';
import { RiskBadge } from './ui';

interface DemoCasePickerProps {
  cases: DemoCasePreset[];
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  entityLabel: 'application' | 'customer';
}

export function DemoCasePicker({ cases, selectedId, loading, onSelect, entityLabel }: DemoCasePickerProps) {
  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-[var(--line)] bg-white" aria-label={`Demo ${entityLabel} IDs`}>
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--subtle)] px-4 py-2.5">
        <BookOpenCheck size={14} className="text-[var(--green)]" />
        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--navy)]">Demo casebook</p>
        <span className="ml-auto text-[9px] text-[var(--muted)]">Select any {entityLabel} to load it</span>
      </div>
      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-5">
        {cases.map((item) => {
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(item.id)}
              aria-label={`Load ${item.id}: ${item.title}`}
              className={`min-h-[108px] bg-white p-3 text-left transition-colors hover:bg-[#f5fbf7] disabled:cursor-wait disabled:opacity-60 ${selected ? 'shadow-[inset_3px_0_0_var(--green)] !bg-[#eef7f2]' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-[var(--green)]">{item.id}</span>
                <RiskBadge level={item.riskLevel} />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[var(--navy)]">{item.title}</p>
              <p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{item.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
