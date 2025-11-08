import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the skeleton (e.g., 'w-24', 'w-full', 'w-1/2')
   */
  width?: string;
  /**
   * Height of the skeleton (e.g., 'h-4', 'h-10', 'h-full')
   */
  height?: string;
  /**
   * Shape of the skeleton
   */
  variant?: 'rectangular' | 'circular' | 'rounded';
  /**
   * Number of skeleton lines (for text blocks)
   */
  lines?: number;
}

/**
 * Base Skeleton component for loading states
 * Provides animated placeholder that matches the design system
 */
export function Skeleton({
  className,
  width = 'w-full',
  height = 'h-4',
  variant = 'rectangular',
  lines,
  ...props
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-700/50';
  
  const variantClasses = {
    rectangular: '',
    circular: 'rounded-full',
    rounded: 'rounded-md',
  };

  if (lines && lines > 1) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              variantClasses[variant],
              width,
              height,
              i === lines - 1 && 'w-3/4' // Last line shorter
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        width,
        height,
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton for text content
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return <Skeleton lines={lines} className={className} />;
}

/**
 * Skeleton for avatar/profile picture
 */
export function SkeletonAvatar({ size = 'h-10 w-10', className }: { size?: string; className?: string }) {
  return <Skeleton variant="circular" width={size} height={size} className={className} />;
}

/**
 * Skeleton for button
 */
export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton variant="rounded" width="w-24" height="h-10" className={className} />;
}

/**
 * Skeleton for card
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 border border-slate-700 rounded-lg space-y-3 bg-slate-800/30', className)}>
      <Skeleton width="w-3/4" height="h-5" />
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
  );
}

