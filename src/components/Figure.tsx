import type { ReactNode } from 'react';

const SIZE = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' } as const;

// One figure with its label above it (best, ao5, moves, TPS...), the same
// in the solve records, the session's figures and a solve's result. Goes in
// a <dl>.
export function Figure({ label, value, size = 'md' }: { label: ReactNode; value: ReactNode; size?: keyof typeof SIZE }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <dt className="whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`flex items-center font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 ${SIZE[size]}`}>{value}</dd>
    </div>
  );
}
