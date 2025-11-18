/**
 * Breadcrumb Component
 * 
 * Dynamic breadcrumb navigation component for showing page hierarchy.
 * Mobile-responsive with proper accessibility.
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
  showHome?: boolean;
  homeLabel?: string;
  homeHref?: string;
}

// =============================================================================
// ROUTE MAPPING
// =============================================================================

const getRouteLabel = (path: string): string => {
  const routeMap: Record<string, string> = {
    '/app': 'Dashboard',
    '/war': 'War Planning',
    '/war-analytics': 'War Analytics',
    '/capital-analytics': 'Capital Analytics',
    '/player-database': 'Player Database',
    '/leadership': 'Leadership',
    '/settings': 'Settings',
  };

  // Check exact match first
  if (routeMap[path]) {
    return routeMap[path];
  }

  // Check if path starts with any route
  for (const [route, label] of Object.entries(routeMap)) {
    if (path.startsWith(route) && route !== '/app') {
      return label;
    }
  }

  // Fallback: capitalize and format path
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
    .join(' > ') || 'Dashboard';
};

// =============================================================================
// COMPONENT
// =============================================================================

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = '',
  separator = <span className="text-slate-500 mx-2">/</span>,
  showHome = true,
  homeLabel = 'Dashboard',
  homeHref = '/app',
}) => {
  const pathname = usePathname();

  // Build breadcrumb items from pathname if not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const builtItems: BreadcrumbItem[] = [];

    if (showHome) {
      builtItems.push({
        label: homeLabel,
        href: homeHref,
      });
    }

    // Build path progressively
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      builtItems.push({
        label: getRouteLabel(currentPath),
        href: isLast ? undefined : currentPath,
      });
    });

    return builtItems;
  })();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn('flex items-center text-sm text-slate-400', className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-2" itemScope itemType="https://schema.org/BreadcrumbList">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isFirst = index === 0;

          return (
            <li
              key={`${item.href || item.label}-${index}`}
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {!isFirst && separator}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-slate-200 transition-colors flex items-center gap-1"
                  itemProp="item"
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span itemProp="name">{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1',
                    isLast && 'text-slate-200 font-medium',
                  )}
                  itemProp="name"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  {item.label}
                </span>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

