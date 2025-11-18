/**
 * CollapsibleSection Component
 * 
 * Collapsible/accordion section component for reducing vertical scrolling
 * on long pages. Remembers user preferences via localStorage.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  storageKey?: string;
  icon?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (expanded: boolean) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  storageKey,
  icon,
  className = '',
  headerClassName = '',
  contentClassName = '',
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          setIsExpanded(JSON.parse(saved));
        }
      } catch (error) {
        console.warn(`[CollapsibleSection] Failed to load state for ${storageKey}:`, error);
      }
    }
    setIsMounted(true);
  }, [storageKey]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(isExpanded));
      } catch (error) {
        console.warn(`[CollapsibleSection] Failed to save state for ${storageKey}:`, error);
      }
    }
  }, [isExpanded, storageKey, isMounted]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div className={cn('border border-brand-border/60 rounded-xl overflow-hidden', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3',
          'bg-brand-surface/40 hover:bg-brand-surface/60',
          'transition-colors text-left',
          headerClassName,
        )}
        aria-expanded={isExpanded}
        aria-controls={`collapsible-content-${title}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="flex-shrink-0 text-slate-400">{icon}</span>}
          <span className="font-semibold text-slate-200 truncate">{title}</span>
        </div>
        <span
          className={cn(
            'flex-shrink-0 text-slate-400 transition-transform',
            isExpanded && 'rotate-180',
          )}
        >
          ▼
        </span>
      </button>
      <div
        id={`collapsible-content-${title}`}
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className={cn('p-4', contentClassName)}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleSection;

