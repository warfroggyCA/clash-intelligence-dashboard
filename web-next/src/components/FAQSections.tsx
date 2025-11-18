"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id: string;
  title: string;
  icon?: string;
  children: ReactNode;
}

const Section = ({ id, title, icon = "", children }: SectionProps) => (
  <section
    id={id}
    className="space-y-4 rounded-2xl bg-slate-900/60 p-6 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.55)] backdrop-blur"
  >
    <h3 className="text-xl font-semibold tracking-tight text-slate-50">
      {icon && <span className="mr-2 text-2xl align-middle">{icon}</span>}
      {title}
    </h3>
    <div className="space-y-4 text-sm leading-relaxed text-slate-300">{children}</div>
  </section>
);

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const Card = ({ title, children, className = "" }: CardProps) => (
  <div className={cn("rounded-xl border border-white/10 bg-slate-900/40 p-4", className)}>
    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">{title}</h4>
    <div className="space-y-2 text-sm text-slate-200">{children}</div>
  </div>
);

interface FAQSectionsProps {
  className?: string;
}

const FAQSections: React.FC<FAQSectionsProps> = ({ className }) => {
  return (
    <div className={cn("space-y-8", className)}>
      <Section id="overview" title="What is Clash Intelligence?" icon="🛰️">
        <p>
          Clash Intelligence is the secure leadership console for our clan family. It ingests roster snapshots, war
          history, capital data, donation ledgers, and Discord workflows into one place so leaders can make decisions
          quickly without juggling spreadsheets.
        </p>
        <Card title="Why leaders rely on it">
          <ul className="list-disc list-inside space-y-1">
            <li>Live roster health: tenure, activity, rush risk, donation velocity, and war readiness in a single pane.</li>
            <li>VIP (Victory Insight Profile) scoring highlights reliable performers and sandbags automatically.</li>
            <li>Built-in workflows for departures, onboarding, Discord publishing, and data refresh visibility.</li>
          </ul>
        </Card>
      </Section>

      <Section id="access" title="Leadership access & onboarding" icon="🔐">
        <p>
          All accounts are created by leaders inside the dashboard. Public sign-up and magic links are disabled on purpose
          so nobody can self-onboard. The process is intentionally transparent and auditable.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="How leaders add someone">
            <ol className="list-decimal list-inside space-y-1 text-slate-200">
              <li>Open Settings → Leadership Access.</li>
              <li>Enter the member&rsquo;s email, optional player tag, role, and initial password.</li>
              <li>Share the credentials privately. The user signs in at <code>/login</code> using that password.</li>
              <li>If the user leaves leadership, revoke the role or disable the Supabase account instantly.</li>
            </ol>
          </Card>
          <Card title="Invite tokens (optional)">
            <p>
              We support clan-scoped invite tokens for quick onboarding, but each redemption still requires in-game proof
              (rename, clan mail phrase, etc.) and leadership approval before a role becomes active. Tokens can be
              single-use, tag-locked, or time-boxed.
            </p>
          </Card>
        </div>
      </Section>

      <Section id="modules" title="Dashboard modules" icon="🧭">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Roster hub">
            <ul className="space-y-1">
              <li>Full member list with tenure, TH, donations, war readiness, and recent notes.</li>
              <li>VIP leader banner with quick jump to the detailed scoring breakdown.</li>
              <li>Smart insights reel for new joiners, promotion candidates, and stale data alerts.</li>
            </ul>
          </Card>
          <Card title="History & operations">
            <ul className="space-y-1">
              <li>Change logs for joins, departures, promotions, and capital milestones.</li>
              <li>Departure manager and joiner manager modals for Discord-ready updates.</li>
              <li>Ingestion monitor, refresh button, and leadership-only quick actions.</li>
            </ul>
          </Card>
          <Card title="Player intelligence">
            <ul className="space-y-1">
              <li>VIP report per player: war efficiency, capital ROI, reliability streaks.</li>
              <li>Player Database for notes, tenure awards, departures, and warnings.</li>
              <li>Coaching prompts and archetype summaries to guide promotion talks.</li>
            </ul>
          </Card>
          <Card title="Settings & governance">
            <ul className="space-y-1">
              <li>Leadership Access manager for email/password creation and role revocation.</li>
              <li>Permission Manager to tailor features per role (e.g., allow elders to view audit log).</li>
              <li>Audit log covering every leadership action with timestamps and user identities.</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="vip" title="How VIP scoring works" icon="🏅">
        <p>
          VIP (Victory Insight Profile) is the current evolution of our performance model. It replaced the legacy ACE
          composite and focuses on consistency, impact, and service across war, capital, and donation lanes. Scores update
          nightly and drive the roster highlights.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Components & weights">
            <ul className="space-y-1">
              <li><strong>War Impact (40%)</strong> – Expected-star delta, clean-up efficiency, defense holds.</li>
              <li><strong>Reliability (25%)</strong> – Attendance streaks, missed hits, friendly challenge reps.</li>
              <li><strong>Capital & Economy (20%)</strong> – Net capital carry, finisher rate, donation balance.</li>
              <li><strong>Service (15%)</strong> – Discord engagement, intel contributions, mentoring notes.</li>
            </ul>
          </Card>
          <Card title="How to use VIP">
            <ul className="space-y-1">
              <li>Spot promotion candidates: filter by VIP band + leadership notes.</li>
              <li>Call out sandbaggers: low VIP + negative trend triggers appear on the roster.</li>
              <li>Context matters: click a player to open their full report with raw data and commentary.</li>
            </ul>
          </Card>
        </div>
        <p>
          Need more math? Check <Link href="/docs/vip_score.md" className="text-brand-primary hover:underline">vip_score.md</Link> for specific formulas, decay rules, and component definitions.
        </p>
      </Section>

      <Section id="data" title="Data sources & refresh cadence" icon="⏱️">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Snapshot pipeline">
            <ul className="space-y-1">
              <li>Daily base snapshot (roughly 04:30 UTC) feeds roster, tenure, and VIP.</li>
              <li>War and capital logs refresh every time the Cron ingestion runs or a leader triggers Refresh.</li>
              <li>Player Database writes (notes, warnings, tenure events) are immediate and never cached.</li>
            </ul>
          </Card>
          <Card title="Refreshing data">
            <ul className="space-y-1">
              <li>Use the Refresh button in the header or Settings → Data to trigger ingestion per clan.</li>
              <li>Ingestion monitor shows each step so you know if Supercell throttled or a job stalled.</li>
              <li>Stale data warnings appear on the roster if the current snapshot is older than 24 hours.</li>
            </ul>
          </Card>
        </div>
        <p>
          If you need custom cadence (e.g., raid weekend every 3 hours), ping engineering. The cron scheduler and
          Supabase storage can handle per-clan overrides.
        </p>
      </Section>

      <Section id="support" title="Troubleshooting & support" icon="🛠️">
        <Card title="Common fixes">
          <ul className="space-y-1">
            <li>Can&rsquo;t log in? Verify the account exists in Leadership Access. If not, a leader must create it.</li>
            <li>Data looks stale? Check the ingestion monitor or trigger Refresh. Cron might be throttled.</li>
            <li>VIP looks wrong? Click the player to inspect raw events; most anomalies are missing war attacks.</li>
          </ul>
        </Card>
        <Card title="Contact paths">
          <ul className="space-y-1">
            <li>#vip-support channel in the leadership Discord.</li>
            <li>Email <Link href="mailto:info@clashintelligence.com" className="text-brand-primary hover:underline">info@clashintelligence.com</Link> for access or data issues.</li>
            <li>Direct DM to the ops engineer listed in Settings → Leadership Access footer.</li>
          </ul>
        </Card>
      </Section>
    </div>
  );
};

export default FAQSections;
