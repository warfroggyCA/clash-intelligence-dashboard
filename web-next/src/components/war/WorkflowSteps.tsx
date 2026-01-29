"use client";

import { cn } from '@/lib/utils';

export type WorkflowStep = {
  number: number;
  title: string;
  description: string;
  status: 'complete' | 'current' | 'upcoming';
};

type WorkflowStepsProps = {
  steps: WorkflowStep[];
};

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ steps }) => {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const indicatorClasses = {
            complete: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/50',
            current: 'bg-[var(--accent-alt)]/15 text-white border-[var(--accent-alt)]',
            upcoming: 'bg-transparent text-slate-300 border-[var(--border-subtle)]',
          }[step.status];

          const labelClasses = {
            complete: 'text-emerald-200',
            current: 'text-[var(--accent-alt)]',
            upcoming: 'text-slate-400',
          }[step.status];

          return (
            <div
              key={step.number}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-3',
                step.status === 'current' && 'ring-1 ring-[var(--accent-alt)]/40',
              )}
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--card)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    indicatorClasses,
                  )}
                >
                  {step.status === 'complete' ? '✓' : step.number}
                </div>
                <div className="flex-1">
                  <p className={cn('text-sm font-semibold', labelClasses)}>{step.title}</p>
                  <p className="text-xs text-slate-400 leading-snug">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowSteps;
