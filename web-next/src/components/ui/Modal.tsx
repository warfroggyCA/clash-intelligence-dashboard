"use client";

/**
 * Reusable Modal Component
 * 
 * A standardized modal component with consistent styling, animations, and accessibility.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ComponentWithChildrenAndClassName } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalProps extends ComponentWithChildrenAndClassName {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
}

// =============================================================================
// STYLE VARIANTS
// =============================================================================

const getSizeStyles = (size: ModalSize): string => {
  const sizes = {
    sm: 'max-w-sm mx-2 sm:mx-4',
    md: 'max-w-md mx-2 sm:mx-4',
    lg: 'max-w-lg mx-2 sm:mx-4',
    xl: 'max-w-xl mx-2 sm:mx-4',
    '2xl': 'max-w-2xl mx-2 sm:mx-4',
    full: 'max-w-full mx-2 sm:mx-4',
  };
  
  return sizes[size];
};

// =============================================================================
// COMPONENT
// =============================================================================

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  className = '',
  'aria-label': ariaLabel,
  'data-testid': testId,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Handle body scroll lock
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeStyles = getSizeStyles(size);
  // Match glass-card styling but with slightly elevated appearance for distinction
  const modalStyles = `relative backdrop-blur-lg rounded-3xl shadow-2xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto ${sizeStyles} ${className}`.trim();
  // Use glass-card gradient but slightly brighter for distinction
  const modalBgStyle: React.CSSProperties = {
    background: 'linear-gradient(160deg, rgba(20, 28, 45, 0.96), rgba(16, 22, 38, 0.94))',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 32px 64px -32px rgba(8, 15, 31, 0.85), 0 0 0 1px rgba(148, 163, 184, 0.1)',
    color: 'rgba(226, 232, 240, 0.95)',
  };

  const modalTree = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div
        ref={modalRef}
        className={modalStyles}
        style={modalBgStyle}
        tabIndex={-1}
        role="document"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700/40">
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-slate-100 pr-2">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 sm:p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center flex-shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 text-slate-200">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
};

// =============================================================================
// PRESET MODALS
// =============================================================================

export const SmallModal: React.FC<Omit<ModalProps, 'size'>> = (props) => (
  <Modal {...props} size="sm" />
);

export const MediumModal: React.FC<Omit<ModalProps, 'size'>> = (props) => (
  <Modal {...props} size="md" />
);

export const LargeModal: React.FC<Omit<ModalProps, 'size'>> = (props) => (
  <Modal {...props} size="lg" />
);

export const ExtraLargeModal: React.FC<Omit<ModalProps, 'size'>> = (props) => (
  <Modal {...props} size="xl" />
);

export const FullModal: React.FC<Omit<ModalProps, 'size'>> = (props) => (
  <Modal {...props} size="full" />
);

export default Modal;
