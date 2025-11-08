/**
 * Role Checking Utility for API Routes
 * Temporary solution for role-based access control using headers
 * TODO: Replace with real authentication when implemented
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if request has leadership role (leader or coLeader)
 * Reads from x-user-role header (set by frontend impersonation)
 */
export function isLeadershipRequest(req: NextRequest): boolean {
  const role = req.headers.get('x-user-role') || 'member';
  return role === 'leader' || role === 'coleader' || role === 'coLeader';
}

/**
 * Get user role from request header
 */
export function getUserRoleFromRequest(req: NextRequest): string {
  return req.headers.get('x-user-role') || 'member';
}

/**
 * Check if request has one of the allowed roles
 */
export function hasRole(req: NextRequest, allowedRoles: string[]): boolean {
  const role = getUserRoleFromRequest(req);
  // Normalize role names
  const normalizedRole = role === 'coLeader' ? 'coleader' : role.toLowerCase();
  return allowedRoles.some(allowed => allowed.toLowerCase() === normalizedRole);
}

/**
 * Require leadership role, throw 403 if not
 * Temporary solution - will be replaced with real auth
 */
export function requireLeadership(req: NextRequest): void {
  if (!isLeadershipRequest(req)) {
    throw new Response('Forbidden: Leadership access required', { status: 403 });
  }
}

/**
 * Require Leader role specifically (not Co-Leader), throw 403 if not
 * Temporary solution - will be replaced with real auth
 */
export function requireLeader(req: NextRequest): void {
  const role = getUserRoleFromRequest(req);
  // Normalize role names (coLeader -> coleader)
  const normalizedRole = role === 'coLeader' ? 'coleader' : role.toLowerCase();
  if (normalizedRole !== 'leader') {
    // Return JSON response for proper error handling
    const errorResponse = NextResponse.json(
      { success: false, error: 'Forbidden: Leader access required' },
      { status: 403 }
    );
    throw errorResponse;
  }
}

