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
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const indicatorClasses = {
            complete: 'bg-primary text-primary-foreground border-primary',
            current: 'bg-primary/10 text-primary border-primary',
            upcoming: 'bg-transparent text-muted-foreground border-border',
          }[step.status];

          const labelClasses = {
            complete: 'text-primary',
            current: 'text-primary',
            upcoming: 'text-slate-400',
          }[step.status];

          return (
            <div
              key={step.number}
              className={cn(
                'flex flex-col gap-2 rounded-xl border border-border/50 bg-slate-950/30 p-3',
                step.status === 'current' && 'ring-1 ring-primary/40',
              )}
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
                  <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
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
