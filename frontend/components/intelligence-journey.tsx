import {
  ArrowRight,
  BrainCircuit,
  Clock3,
  Fingerprint,
  Network,
  UserCheck,
  Workflow,
} from 'lucide-react';

const stages = [
  {
    icon: Fingerprint,
    label: '01 · Observe',
    title: 'Application events',
    description: 'Borrower, device, account, dealer, location, and event-time data arrive as ordinary lending records.',
  },
  {
    icon: Workflow,
    label: '02 · Resolve',
    title: 'Hidden identities',
    description: 'Shared identifiers are resolved into evidence-backed connections without using the outcome label.',
  },
  {
    icon: Network,
    label: '03 · Connect',
    title: 'Relationship graph',
    description: 'Customers and shared entities become a traversable graph that exposes coordinated ecosystems.',
  },
  {
    icon: Clock3,
    label: '04 · Detect',
    title: 'Emerging behaviour',
    description: 'Velocity, bursts, recency, and rapid network growth reveal risk that static checks miss.',
  },
  {
    icon: BrainCircuit,
    label: '05 · Explain',
    title: 'Hybrid risk score',
    description: 'Rules, graph evidence, temporal signals, and ML combine into one traceable 0–100 score.',
  },
  {
    icon: UserCheck,
    label: '06 · Decide',
    title: 'Human action',
    description: 'Analysts receive ranked evidence and a recommended action while retaining final authority.',
  },
];

export function IntelligenceJourney({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`journey-grid ${compact ? 'journey-grid-compact' : ''}`}>
      {stages.map(({ icon: Icon, label, title, description }, index) => (
        <div key={title} className="journey-stage">
          <div className="flex items-center justify-between gap-3">
            <span className="journey-icon"><Icon size={17} /></span>
            {index < stages.length - 1 && (
              <ArrowRight className="journey-arrow" size={15} aria-hidden="true" />
            )}
          </div>
          <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[.15em] text-[var(--blue)]">{label}</p>
          <h3 className="mt-1.5 text-sm font-bold tracking-[-.015em] text-[var(--navy)]">{title}</h3>
          {!compact && <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">{description}</p>}
        </div>
      ))}
    </div>
  );
}
