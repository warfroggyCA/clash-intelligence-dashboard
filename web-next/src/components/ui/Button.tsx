/**
 * Reusable Button Component
 * 
 * A standardized button component with consistent styling, variants, and accessibility.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { ComponentWithChildrenAndClassName } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export type ButtonVariant = 
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ghost'
  | 'outline';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ComponentWithChildrenAndClassName {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

// =============================================================================
// STYLE VARIANTS
// =============================================================================

const getVariantStyles = (variant: ButtonVariant): string => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 border border-blue-400/30 backdrop-blur-sm',
    secondary: 'bg-gradient-to-r from-gray-500 via-gray-600 to-slate-600 text-white shadow-xl hover:shadow-2xl hover:from-gray-600 hover:via-slate-600 hover:to-gray-700 border border-gray-400/30 backdrop-blur-sm',
    success: 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 text-white shadow-xl hover:shadow-2xl hover:from-emerald-600 hover:via-teal-500 hover:to-cyan-600 border border-emerald-400/30 backdrop-blur-sm',
    warning: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white shadow-xl hover:shadow-2xl hover:from-amber-600 hover:via-orange-500 hover:to-red-500 border border-amber-400/30 backdrop-blur-sm',
    danger: 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 text-white shadow-xl hover:shadow-2xl hover:from-red-600 hover:via-pink-500 hover:to-rose-600 border border-red-400/30 backdrop-blur-sm',
    ghost: 'bg-white/20 backdrop-blur-sm text-gray-700 hover:bg-white/40 border border-gray-200/50 shadow-lg hover:shadow-xl',
    outline: 'bg-white/10 backdrop-blur-sm text-blue-600 border-2 border-blue-500/50 hover:bg-blue-50/80 hover:border-blue-600 shadow-lg hover:shadow-xl',
  };
  
  return variants[variant];
};

const getSizeStyles = (size: ButtonSize): string => {
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };
  
  return sizes[size];
};

const getDisabledStyles = (disabled: boolean, loading: boolean): string => {
  if (disabled || loading) {
    return 'opacity-50 cursor-not-allowed pointer-events-none';
  }
  return 'hover:scale-105 active:scale-95';
};

// =============================================================================
// COMPONENT
// =============================================================================

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  title,
  'aria-label': ariaLabel,
  'data-testid': testId,
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 transform-gpu focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:scale-105 active:scale-95';
  
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const disabledStyles = getDisabledStyles(disabled, loading);
  
  const combinedStyles = `${baseStyles} ${variantStyles} ${sizeStyles} ${disabledStyles} ${className}`.trim();
  
  return (
    <button
      type={type}
      className={combinedStyles}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

// =============================================================================
// PRESET BUTTONS
// =============================================================================

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="primary" />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="secondary" />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="success" />
);

export const WarningButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="warning" />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="danger" />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="ghost" />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button {...props} variant="outline" />
);

export default Button;
