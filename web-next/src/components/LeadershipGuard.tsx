import React from 'react';
import { useLeadership } from '../hooks/useLeadership';
import { type RolePermissions } from '../lib/leadership';

interface LeadershipGuardProps {
  children: React.ReactNode;
  requiredPermission: keyof RolePermissions;
  fallback?: React.ReactNode;
  showAccessDenied?: boolean;
  className?: string;
}

export default function LeadershipGuard({
  children,
  requiredPermission,
  fallback,
  showAccessDenied = true,
  className = ""
}: LeadershipGuardProps) {
  const { permissions, isLoading, error } = useLeadership();

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <span className="ml-2 text-gray-600">Checking permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <span className="text-red-600">Error loading permissions: {error}</span>
      </div>
    );
  }

  if (!permissions[requiredPermission]) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    if (!showAccessDenied) {
      return null;
    }

    return (
      <div className={`flex items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Leadership Access Required</h3>
          <p className="text-gray-600">
            This feature is only available to clan leaders and co-leaders.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * A simple wrapper component for leadership-only content
 */
export function LeadershipOnly({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <LeadershipGuard 
      requiredPermission="canViewLeadershipFeatures"
      className={className}
    >
      {children}
    </LeadershipGuard>
  );
}

/**
 * A component that shows different content based on leadership status
 */
export function ConditionalLeadership({
  leadershipContent,
  memberContent,
  className = ""
}: {
  leadershipContent: React.ReactNode;
  memberContent: React.ReactNode;
  className?: string;
}) {
  const { permissions } = useLeadership();

  return (
    <div className={className}>
      {permissions.canViewLeadershipFeatures ? leadershipContent : memberContent}
    </div>
  );
}
