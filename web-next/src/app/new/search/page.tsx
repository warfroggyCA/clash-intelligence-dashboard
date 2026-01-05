"use client";

import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { flattenNav, navConfig, type NavItem } from '@/lib/nav-config';
import { normalizeSearch } from '@/lib/search';

type FeatureItem = ReturnType<typeof flattenNav>[number];

function buildHrefTitleMap(items: NavItem[]): Map<string, string> {
  const map = new Map<string, string>();
  const visit = (node: NavItem) => {
    map.set(node.href, node.title);
    node.children?.forEach(visit);
  };
  items.forEach(visit);
  return map;
}

export default function GlobalSearchPage() {
  const [query, setQuery] = useState('');

  const hrefTitleMap = useMemo(() => buildHrefTitleMap(navConfig), []);
  const features = useMemo(() => flattenNav(navConfig), []);

  const filteredFeatures = useMemo(() => {
    const term = normalizeSearch(query.trim());
    if (!term) {
      return features;
    }
    return features.filter((item) => {
      const haystack = normalizeSearch(
        `${item.title} ${item.description ?? ''} ${item.href}`
      );
      return haystack.includes(term);
    });
  }, [features, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, FeatureItem[]>();
    filteredFeatures.forEach((item) => {
      const topHref = item.parents[0] ?? item.href;
      const groupTitle = hrefTitleMap.get(topHref) ?? 'Features';
      if (!groups.has(groupTitle)) {
        groups.set(groupTitle, []);
      }
      groups.get(groupTitle)!.push(item);
    });
    return groups;
  }, [filteredFeatures, hrefTitleMap]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-slate-400">
            <Sparkles className="h-4 w-4 text-clash-gold" />
            Global Search
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Find any site feature fast</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search across dashboard areas, analytics, and leadership tools.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          {filteredFeatures.length} results
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dashboards, tools, analytics, war features..."
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([groupTitle, items]) => (
          <section key={groupTitle} className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-slate-500">{groupTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((feature, index) => {
                const isAvailable = feature.href && feature.href !== '#';
                return (
                  <a
                    key={`${groupTitle}-${feature.parents.join('/')}-${feature.title}-${feature.href}-${index}`}
                    href={isAvailable ? feature.href : undefined}
                    className={cn(
                      'flex h-full flex-col justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-200 transition',
                      isAvailable
                        ? 'hover:border-clash-gold/40 hover:bg-clash-gold/10'
                        : 'cursor-default opacity-60'
                    )}
                  >
                    <div>
                      <div className="font-semibold text-white">{feature.title}</div>
                      {feature.description && (
                        <p className="mt-1 text-xs text-slate-400">{feature.description}</p>
                      )}
                    </div>
                    <div className="mt-4 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      {isAvailable ? feature.href : 'Coming soon'}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
        {filteredFeatures.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
            No matching features. Try a different search term.
          </div>
        )}
      </div>
    </div>
  );
}
