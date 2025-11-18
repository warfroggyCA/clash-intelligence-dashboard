/**
 * SectionHeader Component
 * 
 * Consistent section title component with optional description text
 * and action buttons.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  icon,
  actions,
  className = '',
  titleClassName = '',
  level = 2,
}) => {
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  const sizeClasses = {
    1: 'text-3xl',
    2: 'text-2xl',
    3: 'text-xl',
    4: 'text-lg',
    5: 'text-base',
    6: 'text-sm',
  };

  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          {icon && (
            <span className="flex-shrink-0 text-slate-400 text-xl">{icon}</span>
          )}
          <HeadingTag
            className={cn(
              'font-semibold text-slate-100 leading-tight',
              sizeClasses[level],
              titleClassName,
            )}
          >
            {title}
          </HeadingTag>
        </div>
        {description && (
          <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

export default SectionHeader;

