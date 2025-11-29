"use client";

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import BaseBreadcrumbs, { type BreadcrumbItem } from '@/components/ui/Breadcrumbs';
import { flattenNav } from '@/lib/nav-config';

function normalizeHref(href: string) {
  return href.replace(/\[.*?\]/g, '');
}

function matchesPath(pathname: string, href: string) {
  const normalized = normalizeHref(href);
  return pathname === href || pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function buildItemsFromNav(pathname: string): BreadcrumbItem[] {
  const flattened = flattenNav();
  const hrefMap = new Map(flattened.map((item) => [item.href, item]));

  const active = [...flattened]
    .filter((item) => matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!active) {
    return [{ label: 'Dashboard', href: '/app' }];
  }

  const trailHrefs = [...active.parents, active.href];
  const items: BreadcrumbItem[] = trailHrefs
    .map((href) => {
      const entry = hrefMap.get(href);
      if (!entry) return null;
      return { label: entry.title, href: href };
    })
    .filter(Boolean) as BreadcrumbItem[];

  return items;
}

export interface LayoutBreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<LayoutBreadcrumbsProps> = ({ items, className }) => {
  const pathname = usePathname();

  const computedItems = useMemo(() => {
    if (items) return items;
    return buildItemsFromNav(pathname);
  }, [items, pathname]);

  return <BaseBreadcrumbs items={computedItems} className={className} showHome={false} />;
};

export default Breadcrumbs;
