/**
 * Reusable Input Component
 * 
 * A standardized input component with consistent styling, validation, and accessibility.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type InputVariant = 'default' | 'error' | 'success' | 'warning';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  size?: InputSize;
  label?: string;
  helperText?: string;
  errorText?: string;
  successText?: string;
  warningText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
}

// =============================================================================
// STYLE VARIANTS
// =============================================================================

const getVariantStyles = (variant: InputVariant): string => {
  const variants = {
    default: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    error: 'border-red-300 focus:border-red-500 focus:ring-red-500',
    success: 'border-green-300 focus:border-green-500 focus:ring-green-500',
    warning: 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500',
  };
  
  return variants[variant];
};

const getSizeStyles = (size: InputSize): string => {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg',
  };
  
  return sizes[size];
};

// =============================================================================
// COMPONENT
// =============================================================================

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  size = 'md',
  label,
  helperText,
  errorText,
  successText,
  warningText,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  type = 'text',
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  // Determine the actual variant based on error/success/warning states
  const actualVariant = errorText ? 'error' : successText ? 'success' : warningText ? 'warning' : variant;
  
  const variantStyles = getVariantStyles(actualVariant);
  const sizeStyles = getSizeStyles(size);
  
  const baseInputStyles = 'w-full border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50';
  
  const inputStyles = `${baseInputStyles} ${variantStyles} ${sizeStyles} ${inputClassName} ${className}`.trim();

  // Handle password toggle
  const actualType = showPasswordToggle && type === 'password' 
    ? (showPassword ? 'text' : 'password')
    : type;

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword);
  };

  const getStatusText = () => {
    if (errorText) return errorText;
    if (successText) return successText;
    if (warningText) return warningText;
    return helperText;
  };

  const getStatusIcon = () => {
    if (errorText) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (successText) return <AlertCircle className="w-4 h-4 text-green-500" />;
    if (warningText) return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    return null;
  };

  const getStatusTextColor = () => {
    if (errorText) return 'text-red-600';
    if (successText) return 'text-green-600';
    if (warningText) return 'text-yellow-600';
    return 'text-gray-500';
  };

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className={`block text-sm font-medium text-gray-700 ${labelClassName}`}>
          {label}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {leftIcon}
            </div>
          </div>
        )}

        {/* Input */}
        <input
          {...props}
          type={actualType}
          className={inputStyles}
          style={{
            paddingLeft: leftIcon ? '2.5rem' : undefined,
            paddingRight: (rightIcon || showPasswordToggle) ? '2.5rem' : undefined,
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />

        {/* Right Icon */}
        {(rightIcon || showPasswordToggle) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPasswordToggle ? (
              <button
                type="button"
                onClick={handlePasswordToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="text-gray-400">
                {rightIcon}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper/Status Text */}
      {getStatusText() && (
        <div className="flex items-center space-x-1">
          {getStatusIcon()}
          <p className={`text-sm ${getStatusTextColor()}`}>
            {getStatusText()}
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PRESET INPUTS
// =============================================================================

export const TextInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input {...props} type="text" />
);

export const EmailInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input {...props} type="email" />
);

export const PasswordInput: React.FC<Omit<InputProps, 'type' | 'showPasswordToggle'>> = (props) => (
  <Input {...props} type="password" showPasswordToggle />
);

export const NumberInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input {...props} type="number" />
);

export const SearchInput: React.FC<Omit<InputProps, 'type'>> = (props) => (
  <Input {...props} type="search" />
);

export const SmallInput: React.FC<Omit<InputProps, 'size'>> = (props) => (
  <Input {...props} size="sm" />
);

export const LargeInput: React.FC<Omit<InputProps, 'size'>> = (props) => (
  <Input {...props} size="lg" />
);

export default Input;
