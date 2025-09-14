/**
 * Reusable Modal Component
 * 
 * A standardized modal component with consistent styling, animations, and accessibility.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ComponentWithChildrenAndClassName } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

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
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeStyles = getSizeStyles(size);
  const modalStyles = `relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full ${sizeStyles} ${className}`.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-black/20 via-purple-900/20 to-blue-900/30 backdrop-blur-md"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div
        ref={modalRef}
        className={modalStyles}
        tabIndex={-1}
        role="document"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            {title && (
              <h2 className="text-xl font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
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
