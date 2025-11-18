"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  id: string;
  title: string;
  icon?: string;
  children: ReactNode;
};

const Section = ({ id, title, icon, children }: SectionProps) => (
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

type CardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

const Card = ({ title, children, className }: CardProps) => (
  <div className={cn("rounded-xl border border-white/10 bg-slate-900/40 p-4", className)}>
    <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-3">{title}</h4>
    <div className="space-y-2 text-sm text-slate-200">{children}</div>
  </div>
);

type UserFAQSectionsProps = {
  className?: string;
};

const UserFAQSections: React.FC<UserFAQSectionsProps> = ({ className }) => {
  return (
    <div className={cn("space-y-8", className)}>
      <Section id="getting-started" title="Getting started" icon="🚀">
        <p>
          Clash Intelligence is the private dashboard for the HeckYeah clan family. Every member gets an account from a
          leader—there is no public sign-up. Once you receive your email + temporary password, head to{" "}
          <code>https://heckyeah.clashintelligence.com/login</code> and sign in.
        </p>
        <Card title="First login checklist">
          <ol className="list-decimal list-inside space-y-1 text-slate-200">
            <li>Open the login page on your phone or desktop browser.</li>
            <li>Enter the email and temporary password your leader shared.</li>
            <li>When prompted, create a new password only you know.</li>
            <li>Complete onboarding by selecting the player tag(s) you own.</li>
          </ol>
        </Card>
      </Section>

      <Section id="onboarding" title="Linking your player tags" icon="🏷️">
        <p>
          After you sign in, the dashboard shows the roster for our home clan. Pick every account that belongs to you.
          Your first selection becomes your primary identity, and any extras are linked as hidden minis so leadership can
          see the connections.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="What if my tag is missing?">
            <ul className="space-y-1">
              <li>Tap Refresh on the onboarding page—roster data might be older than one hour.</li>
              <li>If the tag still does not appear, ping a leader so they can re-ingest the clan or add you to the roster.</li>
              <li>Never select someone else’s account. That blocks them from onboarding later.</li>
            </ul>
          </Card>
          <Card title="Can other members see my email?">
            <p>
              No. Once you finish onboarding, the dashboard displays your Clash name and tag. Emails only appear in the
              leadership-only settings page.
            </p>
          </Card>
        </div>
      </Section>

      <Section id="multi-accounts" title="Multiple accounts & privacy" icon="🪄">
        <p>
          Many of us run several minis on the same email. Linking them during onboarding keeps the roster accurate while
          hiding the relationships from regular members. Only leadership can see the alias graph.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="To add another account later">
            <ol className="list-decimal list-inside space-y-1">
              <li>Visit Settings → Linked accounts.</li>
              <li>Click “Add account” and enter the new tag.</li>
              <li>A leader approves the link, and it becomes private aliases right away.</li>
            </ol>
          </Card>
          <Card title="Hiding relationships">
            <p>
              A future update will let you show or hide linked accounts in your profile. Until then, assume aliases are
              visible only to leadership, not to regular members or guests.
            </p>
          </Card>
        </div>
      </Section>

      <Section id="using-dashboard" title="Using the dashboard" icon="📊">
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="What members can see">
            <ul className="space-y-1">
              <li>Your own profile, historical stats, and linked accounts.</li>
              <li>The roster list with tenure, Town Halls, and basic activity markers.</li>
              <li>War Prep read-only view (plan, opponent roster, matchup context).</li>
            </ul>
          </Card>
          <Card title="What stays leadership-only">
            <ul className="space-y-1">
              <li>Quick Actions (ingestion, AI analysis, Discord brief publishing).</li>
              <li>Active Access, permissions editor, and tracked clan management.</li>
              <li>Detailed VIP scoring panels, warnings, and coaching notes.</li>
            </ul>
          </Card>
        </div>
        <p>
          If a section says “Leadership only,” it simply means you need a higher role. Nothing is broken—ask a leader if
          you believe you should have access.
        </p>
      </Section>

      <Section id="support" title="Need help?" icon="📬">
        <Card title="Support channels">
          <ul className="space-y-1">
            <li>
              <strong>Discord:</strong> Use #dashboard-help for quick questions. Mention your Clash name so we can look up
              your tag.
            </li>
            <li>
              <strong>Email:</strong>{" "}
              <Link href="mailto:info@clashintelligence.com" className="text-brand-primary hover:underline">
                info@clashintelligence.com
              </Link>
              {" "}for access issues or bug reports.
            </li>
            <li>
              <strong>Leaders:</strong> DM your co-leaders if your tag changes, you leave the clan temporarily, or you
              notice stale data.
            </li>
          </ul>
        </Card>
        <Card title="Troubleshooting quick hits">
          <ul className="space-y-1">
            <li>Reset password from the login page if you forget it. Leaders can also trigger a reset from Settings.</li>
            <li>Use Chrome, Safari, or Edge on the latest version—older browsers might block the onboarding flow.</li>
            <li>Clear cookies or use incognito if you get stuck on “Checking access…” after a logout.</li>
          </ul>
        </Card>
      </Section>
    </div>
  );
};

export default UserFAQSections;
