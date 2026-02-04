"use client";

import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function HelpTip({
  label,
  content,
}: {
  label: string;
  content: React.ReactNode;
}) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center align-middle text-slate-500 hover:text-slate-200"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
}
