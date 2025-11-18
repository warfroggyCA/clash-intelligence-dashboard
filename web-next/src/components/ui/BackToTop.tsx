/**
 * BackToTop Component
 * 
 * "Back to Top" button component for long pages.
 * Shows when scrolled >500px with smooth scroll animation.
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

export interface BackToTopProps {
  threshold?: number;
  className?: string;
  showText?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BackToTop: React.FC<BackToTopProps> = ({
  threshold = 500,
  className = '',
  showText = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-8 right-8 z-50',
        'flex items-center justify-center gap-2',
        'px-4 py-3 rounded-full',
        'bg-brand-primary text-white',
        'shadow-lg hover:shadow-xl',
        'transition-all duration-300',
        'hover:scale-110 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-brand-surface',
        className,
      )}
      aria-label="Back to top"
    >
      <span className="text-xl">↑</span>
      {showText && <span className="text-sm font-medium">Top</span>}
    </button>
  );
};

export default BackToTop;

