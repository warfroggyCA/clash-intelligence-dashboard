import React, { useState, useEffect } from 'react';
import { type ClanRole, getRoleDisplayName } from '../lib/leadership';

interface UserRoleSelectorProps {
  onRoleChange: (role: ClanRole) => void;
  currentRole: ClanRole;
  className?: string;
}

export default function UserRoleSelector({ 
  onRoleChange, 
  currentRole, 
  className = "" 
}: UserRoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const roles: ClanRole[] = ['leader', 'coLeader', 'elder', 'member'];

  const handleRoleChange = (role: ClanRole) => {
    onRoleChange(role);
    setIsOpen(false);
    
    // Store in localStorage for persistence
    localStorage.setItem('clash-intelligence-user-role', role);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <span className="text-sm font-medium">Role:</span>
        <span className="text-sm text-gray-700">{getRoleDisplayName(currentRole)}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  currentRole === role ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{getRoleDisplayName(role)}</span>
                  {currentRole === role && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage user role state with localStorage persistence
 * Hydration-safe implementation to prevent SSR/client mismatches
 */
export function useUserRole(): [ClanRole, (role: ClanRole) => void, boolean] {
  const [userRole, setUserRole] = useState<ClanRole>('member');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated after component mounts on client
    setIsHydrated(true);
    
    // Load from localStorage after hydration
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('clash-intelligence-user-role');
      if (stored && ['leader', 'coLeader', 'elder', 'member'].includes(stored)) {
        setUserRole(stored as ClanRole);
      } else {
        localStorage.setItem('clash-intelligence-user-role', 'member');
      }
    }
  }, []);

  const updateUserRole = (role: ClanRole) => {
    setUserRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('clash-intelligence-user-role', role);
    }
  };

  return [userRole, updateUserRole, isHydrated];
}
