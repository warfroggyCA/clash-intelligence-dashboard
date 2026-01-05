"use client";

import Link from 'next/link';
import { cn } from '@/lib/utils';

type CwlStepKey = 'setup' | 'roster' | 'day';

type CwlStepBarProps = {
  current: CwlStepKey;
  dayIndex?: number;
};

export const CwlStepBar: React.FC<CwlStepBarProps> = ({ current, dayIndex }) => {
  const steps = [
    { key: 'setup', label: 'Setup', href: '/new/war/cwl/setup' },
    { key: 'roster', label: 'Season Roster', href: '/new/war/cwl/roster' },
    {
      key: 'day',
      label: 'Day Planner',
      href: dayIndex ? `/new/war/cwl/day/${dayIndex}` : '/new/war/cwl/day/1',
    },
  ] as const;

  const activeIndex = steps.findIndex((step) => step.key === current);

  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
    >
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">CWL flow</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {steps.map((step, index) => {
          const isActive = step.key === current;
          const isComplete = activeIndex > -1 && index < activeIndex;
          const circleClasses = isActive
            ? 'border-[var(--accent-alt)] text-white'
            : isComplete
              ? 'border-emerald-400/40 text-emerald-200'
              : 'border-[var(--border-subtle)] text-slate-300';
          return (
            <div key={step.key} className="flex items-center gap-2">
              <Link
                href={step.href}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  isActive
                    ? 'border-[var(--accent-alt)] bg-[var(--accent-alt)]/20 text-white'
                    : isComplete
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-[var(--border-subtle)] bg-white/5 text-slate-300 hover:text-white',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[11px]', circleClasses)}>
                  {index + 1}
                </span>
                <span>{step.label}</span>
              </Link>
              {index < steps.length - 1 ? <span className="text-slate-500">{'>'}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CwlStepBar;
