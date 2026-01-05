/**
 * Tooltip Component
 * 
 * A standardized tooltip component with consistent styling, positioning, and accessibility.
 * Supports hover, click, and keyboard triggers.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  trigger?: 'hover' | 'click' | 'focus';
  maxWidth?: string;
}

// =============================================================================
// POSITION CALCULATIONS
// =============================================================================

const getPositionClasses = (position: TooltipPosition): string => {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  return positions[position];
};

const getArrowClasses = (position: TooltipPosition): string => {
  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };
  return arrows[position];
};

const getArrowColor = (position: TooltipPosition): React.CSSProperties => {
  const colors = {
    top: { borderTopColor: 'var(--card)' },
    bottom: { borderBottomColor: 'var(--card)' },
    left: { borderLeftColor: 'var(--card)' },
    right: { borderRightColor: 'var(--card)' },
  };
  return colors[position];
};

// =============================================================================
// COMPONENT
// =============================================================================

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  className = '',
  contentClassName = '',
  trigger = 'hover',
  maxWidth = 'max-w-md',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setIsMounted(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    // Delay unmounting for fade-out animation
    setTimeout(() => setIsMounted(false), 150);
  };

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  };

  // Handle click outside for click trigger
  useEffect(() => {
    if (trigger === 'click' && isVisible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          tooltipRef.current &&
          triggerRef.current &&
          !tooltipRef.current.contains(event.target as Node) &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          hideTooltip();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [trigger, isVisible]);

  // Handle escape key
  useEffect(() => {
    if (isVisible) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          hideTooltip();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isVisible]);

  const triggerProps =
    trigger === 'hover'
      ? {
          onMouseEnter: showTooltip,
          onMouseLeave: hideTooltip,
        }
      : trigger === 'click'
        ? {
            onClick: handleClick,
          }
        : {
            onFocus: showTooltip,
            onBlur: hideTooltip,
          };

  return (
    <div className={cn('relative inline-block', className)} ref={triggerRef} {...triggerProps}>
      {children}
      {isMounted && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 pointer-events-none',
            getPositionClasses(position),
            isVisible ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-150',
          )}
          role="tooltip"
          aria-hidden={!isVisible}
        >
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-sm text-slate-200 shadow-lg min-w-[220px]',
              maxWidth,
              contentClassName,
            )}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {typeof content === 'string' ? (
              <p className="whitespace-normal break-words">{content}</p>
            ) : (
              content
            )}
          </div>
          <div
            className={cn(
              'absolute w-0 h-0 border-4',
              getArrowClasses(position),
            )}
            style={getArrowColor(position)}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
