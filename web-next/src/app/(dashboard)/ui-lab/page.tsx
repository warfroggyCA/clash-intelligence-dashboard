"use client";

import React from 'react';
import {
  InfoCard,
  MetricBar,
  Button,
  SectionCard,
  HeroLevel,
  TownHallBadge,
  LeagueBadge,
  Badge,
  BadgeToken,
} from '@/components/ui';
import { Flame, Sparkles, Star, Users } from 'lucide-react';

const heroLevels = [
  { hero: 'BK' as const, level: 85, max: 90 },
  { hero: 'AQ' as const, level: 90, max: 95 },
  { hero: 'GW' as const, level: 65, max: 70 },
  { hero: 'RC' as const, level: 55, max: 65 },
];

export default function UILabPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">UI Kit</p>
        <h1 className="text-3xl font-semibold text-white">Component Lab</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Sandbox for the new InfoCard + MetricBar primitives. Drop additional components here to
          preview styling before integrating them into the Dashboard or War Planning flows.
        </p>
      </header>

      <SectionCard
        title="InfoCard Examples"
        subtitle="Primary vs. interactive variants"
        actions={<span className="text-xs text-slate-400">/src/components/ui/InfoCard.tsx</span>}
        className="bg-white/5 border border-white/10"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <InfoCard
            kicker="Roster Spotlight"
            title="DoubleD"
            subtitle="Town Hall 16 • Co-Leader"
            leading={
              <div className="flex flex-col items-center gap-2">
                <TownHallBadge level={16} size="lg" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-clash-gold">
                  #VGQVRLRL
                </span>
              </div>
            }
            trailing={
              <div className="flex flex-col items-center gap-2">
                <LeagueBadge league="Legend League" size="lg" showText={false} />
                <span className="text-xs text-slate-400">Legend League</span>
              </div>
            }
            badges={[
              { label: 'Active', tone: 'success' },
              { label: 'War Ready', tone: 'accent', icon: <Flame className="h-3 w-3" /> },
            ]}
            stats={[
              { label: 'War Stars', value: '312' },
              { label: 'Hero Avg', value: '86.5', hint: 'Includes pets' },
              { label: 'Legends Rating', value: '5,240' },
            ]}
            metadata={[
              { label: 'Joined', value: 'Aug 2024' },
              { label: 'Last Sync', value: '34m ago' },
            ]}
            footer="Card remains static; pass href / onClick for interactive behavior."
          >
            <div className="flex flex-wrap gap-2">
              <BadgeToken label="War MVP" tier="legendary" icon={<Flame className="h-3.5 w-3.5" />} description="6 stars with 95% destruction" />
              <BadgeToken label="Strategist" tier="epic" icon={<Sparkles className="h-3.5 w-3.5" />} description="10 approved war plans" />
              <BadgeToken label="Capital Raider" tier="rare" icon={<Star className="h-3.5 w-3.5" />} description="75k capital gold donated" />
            </div>
            <div className="grid grid-cols-2 gap-3">
<<<<<<< HEAD
              <MetricBar label="Offense Readiness" value={92} tone="accent" helperText="+4.2 vs clan avg" />
=======
              <MetricBar label="Offense Readiness" value={92} tone="brand" helperText="+4.2 vs clan avg" />
>>>>>>> origin/fix/discord-markdown-formatting
              <MetricBar label="Defense Readiness" value={81} tone="info" helperText="Base rank: A" />
            </div>
          </InfoCard>

          <InfoCard
            kicker="Interactive"
            title="Tap to view roster detail"
            subtitle="Example of InfoCard behaving as link"
            leading={<TownHallBadge level={15} />}
            trailing={<LeagueBadge league="Champion League I" showText={false} />}
            badges={[{ label: 'Clickable', tone: 'info', icon: <Sparkles className="h-3 w-3" /> }]}
            actions={<Button size="sm" variant="ghost">Open</Button>}
            href="/simple-roster"
            interactive
            footer={
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5" /> Navigates to `/simple-roster`
              </div>
            }
          >
            <div className="grid gap-3">
              {heroLevels.map((hero) => (
                <HeroLevel key={hero.hero} showName hero={hero.hero} level={hero.level} maxLevel={hero.max} />
              ))}
            </div>
          </InfoCard>

          <InfoCard
            kicker="Lean Variant"
            title="DoubleD"
            subtitle="10v10 Specialist • TH16"
            leading={<TownHallBadge level={16} />}
            trailing={<LeagueBadge league="Legend League" showText={false} />}
            badges={[
              { label: 'Active', tone: 'success' },
              { label: 'War Ready', tone: 'accent' },
            ]}
            actions={<Button size="sm">View profile</Button>}
            metadata={[
              { label: 'Season XP', value: '12,450' },
              { label: 'Quests', value: '4/5 complete' },
            ]}
            footer={
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Open profile to expand achievements & history</span>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            }
          >
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeToken
                  label="War MVP"
                  tier="legendary"
                  icon={<Flame className="h-3.5 w-3.5" />}
                  description="Unlocked Nov 2025 • 6 stars with 95% destruction"
                />
                <BadgeToken
                  label="Strategist"
                  tier="epic"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  description="10 approved war plans"
                />
                <BadgeToken
                  label="Capital Raider"
                  tier="rare"
                  icon={<Star className="h-3.5 w-3.5" />}
                  description="75k capital gold this season"
                />
                <BadgeToken
                  label="+2 more"
                  tier="common"
                  earned={false}
                  description="Tap profile to reveal remaining badges"
                />
              </div>
            </div>
          </InfoCard>
        </div>
      </SectionCard>

      <SectionCard
        title="Badge Tokens"
        subtitle="Compact inline badges"
        actions={<span className="text-xs text-slate-400">/src/components/ui/BadgeToken.tsx</span>}
        className="bg-white/5 border border-white/10"
      >
        <div className="flex flex-wrap items-center gap-3">
          <BadgeToken
            label="War MVP"
            tier="legendary"
            icon={<Flame className="h-4 w-4" />}
            description="Unlocked Nov 2025 — 6 stars, 95%+ destruction"
          />
          <BadgeToken
            label="Strategist"
            tier="epic"
            icon={<Sparkles className="h-4 w-4" />}
            description="10 approved war plans"
          />
          <BadgeToken
            label="Capital Raider"
            tier="rare"
            icon={<Star className="h-4 w-4" />}
            description="Donated 75k capital gold this season"
          />
          <BadgeToken
            label="In Progress"
            tier="common"
            icon={<Users className="h-4 w-4" />}
            earned={false}
            description="Complete 3 mentoring sessions to unlock"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Badge Showcase"
        subtitle="Example gamification badges"
        actions={<span className="text-xs text-slate-400">/src/components/ui/Badge.tsx</span>}
        className="bg-white/5 border border-white/10"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Badge
            tier="legendary"
            label="War MVP"
            description="Earned by posting 6+ stars in a war with >90% destruction."
            icon={<Flame className="h-5 w-5 text-amber-200" />}
            progress={6}
            goal={6}
            xp={750}
            earnedAt="Nov 2025"
          />
          <Badge
            tier="epic"
            label="Strategist"
            description="Submitted 10 approved war plans."
            icon={<Sparkles className="h-5 w-5 text-indigo-200" />}
            progress={8}
            goal={10}
            xp={400}
            earnedAt="Oct 2025"
          />
          <Badge
            tier="rare"
            label="Capital Raider"
            description="Donated 75k capital gold this season."
            icon={<Star className="h-5 w-5 text-amber-200" />}
            progress={54000}
            goal={75000}
            xp={250}
            earnedAt="Seasonal"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="MetricBar Playground"
        subtitle="Progress, targets, helper text, tones"
        actions={<span className="text-xs text-slate-400">/src/components/ui/MetricBar.tsx</span>}
        className="bg-white/5 border border-white/10"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <MetricBar
              label="Capital Gold"
              value={72}
              helperText="Solid track (default)"
              tone="warning"
              targetValue={85}
              targetLabel={<Star className="h-3 w-3 text-amber-300" />}
            />
            <MetricBar
              label="Capital Gold (Outline)"
              value={72}
              helperText="Outlined track"
              tone="warning"
              targetValue={85}
              targetLabel={<Star className="h-3 w-3 text-amber-300" />}
              variant="outlined"
            />
            <MetricBar
              label="Capital Gold (Minimal)"
              value={72}
              helperText="No track fill"
              tone="warning"
              targetValue={85}
              targetLabel={<Star className="h-3 w-3 text-amber-300" />}
              variant="minimal"
            />
            <MetricBar
              label="Capital Gold (Candlestick)"
              value={72}
              helperText="Subtle total-length indicator"
              tone="warning"
              targetValue={85}
              targetLabel={<Star className="h-3 w-3 text-amber-300" />}
              variant="candlestick"
            />
          </div>
          <MetricBar
            label="Clan Games"
            value={80}
            helperText="Outpace last season by 1,200 pts"
            tone="success"
            size="sm"
            showValue={false}
          />
          <MetricBar
            label="War Coverage"
            value={6}
            max={10}
            helperText="6/10 targets assigned"
            tone="info"
          />
          <MetricBar
            label="Rushed Risk"
            value={25}
            max={100}
            helperText="Lower is better"
            tone="danger"
          />
        </div>
      </SectionCard>
    </div>
  );
}
