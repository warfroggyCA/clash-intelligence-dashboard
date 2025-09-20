/**
 * Theme Toggle Component
 * 
 * A beautiful theme toggle switch with smooth animations and accessibility features.
 * Supports light, dark, and system theme modes.
 * 
 * Features:
 * - Smooth animations and transitions
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - System theme detection
 * - Visual feedback for current theme
 * - Responsive design
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/contexts/theme-context';
import { Sun, Moon, Monitor } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface ThemeToggleProps {
  className?: string;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabels = false,
  size = 'md'
}) => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  const themes = [
    { key: 'light' as const, icon: Sun, label: 'Light' },
    { key: 'dark' as const, icon: Moon, label: 'Dark' },
    { key: 'system' as const, icon: Monitor, label: 'System' }
  ];

  // Use appropriate icon based on current theme
  const CurrentIcon = theme === 'light' ? Sun : Moon;

  return (
    <div className={`relative ${className}`}>
      {/* Main Toggle Button - Always dark themed */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${sizeClasses[size]}
          relative flex items-center justify-center
          bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 
          border-slate-600 text-slate-200
          border
          rounded-lg
          transition-all duration-200
          hover:scale-105 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-clash-gold/50
          shadow-lg hover:shadow-xl
        `}
        aria-label="Theme toggle. Click to change theme."
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <CurrentIcon 
          size={iconSizes[size]} 
          className="text-clash-gold transition-transform duration-200"
        />
        
        {/* Active indicator */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-clash-gold rounded-full border-2 border-slate-800" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-48 z-20">
            <div 
              className="border rounded-lg shadow-xl overflow-hidden"
              style={{ 
                backgroundColor: '#1e293b', 
                borderColor: '#475569', 
                color: '#e2e8f0' 
              }}
            >
              <div 
                className="px-3 py-2 border-b"
                style={{ borderColor: '#475569' }}
              >
                <p 
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#cbd5e1' }}
                >
                  Theme
                </p>
              </div>
              
              {themes.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTheme(key);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 focus:outline-none"
                  style={{ 
                    color: '#e2e8f0',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#334155';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.backgroundColor = '#334155';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  aria-label={`Switch to ${label} theme`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
              
              {/* Quick Toggle */}
              <div 
                className="border-t px-4 py-3"
                style={{ borderColor: '#475569' }}
              >
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors duration-150 font-medium"
                  style={{ 
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    color: '#fbbf24'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.1)';
                  }}
                >
                  <Moon size={16} />
                  Switch to Dark
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Labels (optional) */}
      {showLabels && (
        <div className="mt-2 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Theme Toggle
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default ThemeToggle;
