/**
 * EmptyState Component
 * 
 * Component for displaying empty states with actionable messaging,
 * links to documentation, and optional preview/example content.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from './Button';

// =============================================================================
// TYPES
// =============================================================================

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  variant?: 'default' | 'minimal' | 'illustrated';
  children?: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  variant = 'default',
  children,
}) => {
  const variantClasses = {
    default: 'py-12 px-6',
    minimal: 'py-8 px-4',
    illustrated: 'py-16 px-8',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        variantClasses[variant],
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-6xl text-slate-500/50 flex-shrink-0">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
      )}
      {children && <div className="mb-6 w-full max-w-md">{children}</div>}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <>
              {action.href ? (
                <Link href={action.href}>
                  <Button variant="primary" size="md">
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="primary" size="md" onClick={action.onClick}>
                  {action.label}
                </Button>
              )}
            </>
          )}
          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <Button variant="outline" size="md">
                    {secondaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="md" onClick={secondaryAction.onClick}>
                  {secondaryAction.label}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;

