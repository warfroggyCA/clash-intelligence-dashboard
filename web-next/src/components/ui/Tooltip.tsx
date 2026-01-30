/**
 * Tooltip Component (Portal Version)
 * 
 * A standardized tooltip component that renders via a React Portal to avoid
 * being clipped by parent containers with overflow: hidden.
 */

'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

interface Coords {
  top: number;
  left: number;
}

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
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const offset = 8; // distance from trigger

    switch (position) {
      case 'top':
        top = triggerRect.top + scrollY - tooltipRect.height - offset;
        left = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + scrollY + offset;
        left = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left + scrollX - tooltipRect.width - offset;
        break;
      case 'right':
        top = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + scrollX + offset;
        break;
    }

    setCoords({ top, left });
  }, [position]);

  // Re-calculate position whenever visible or scrolled/resized
  useLayoutEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isVisible, position, updateCoords]);

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setIsMounted(true);
      // Wait one frame for the element to mount so we can measure it
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setTimeout(() => setIsMounted(false), 150);
  };

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) hideTooltip();
      else showTooltip();
    }
  };

  useEffect(() => {
    if (trigger === 'click' && isVisible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          tooltipRef.current && triggerRef.current &&
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

  useEffect(() => {
    if (isVisible) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') hideTooltip();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isVisible]);

  const triggerProps = trigger === 'hover' 
    ? { onMouseEnter: showTooltip, onMouseLeave: hideTooltip }
    : trigger === 'click'
      ? { onClick: handleClick }
      : { onFocus: showTooltip, onBlur: hideTooltip };

  // Helper for arrow positioning - since we are in a portal, 
  // arrows are harder to do with pure CSS classes that rely on parent context.
  // We keep it simple: the arrow is part of the tooltip container.
  
  return (
    <div className={cn('relative inline-block', className)} ref={triggerRef} {...triggerProps}>
      {children}
      {isMounted && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={cn(
            'fixed z-[9999] pointer-events-none transition-opacity duration-150',
            isVisible ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            top: coords.top,
            left: coords.left,
          }}
          role="tooltip"
          aria-hidden={!isVisible}
        >
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-sm text-slate-200 shadow-xl min-w-[220px]',
              maxWidth,
              contentClassName,
            )}
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {typeof content === 'string' ? (
              <p className="whitespace-normal break-words">{content}</p>
            ) : (
              content
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip;
