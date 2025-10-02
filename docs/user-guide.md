# Clash Intelligence Dashboard User Guide (Draft)

> Living document tracked in Git. Update this guide alongside feature work until v1.0 is ready for release.

- **Target release**: v1.0 (in development)
- **Last reviewed**: 2025-10-01
- **Audience**: Clan leaders, analysts, and trusted members using the Clash Intelligence dashboard.

---

## Welcome

Clash Intelligence turns daily Clash of Clans roster snapshots into a clear, leadership-ready dashboard. This guide walks you through the core experience—signing in, reading the data, and acting on the insights—without digging into implementation details. Keep it open while you explore; we’ll update it alongside new releases.

---

## Quick Start

1. **Sign in** – Visit `/login`, enter your email, then either provide your password or request a magic link. Once confirmed you’ll land on the dashboard home.
2. **Check the clan banner** – The header shows which clan is loaded. Leaders see their current role badge.
3. **Review the snapshot** – The Dashboard tab opens by default with current roster metrics and season progress. Look for the freshness badge to confirm how recent the data is.
4. **Explore other tabs** – Use the emoji tabs across the top to jump to Insights, History, or leadership tools. Tabs you don’t have permission to use stay hidden.
5. **Stay informed** – Toasts in the bottom corner call out successes or issues (for example, if a refresh fails).

Tip: Leaders can switch clans or reload the “home” clan from the command rail on the right-hand side.

---

## Dashboard Basics

- **Header strip** – Shows clan name, your role (or impersonated role), data freshness, and quick toggles (theme, font size, leadership preview).
- **Tab navigation** – Emoji-labelled buttons across the top. Only tabs you’re allowed to view appear. The active tab is highlighted.
- **Main canvas** – Fills the center of the page with cards, tables, and charts relevant to the selected tab.
- **Command rail** *(leaders and trusted roles)* – A collapsible right-side panel summarizing snapshot health, offering refresh buttons, and linking to leadership utilities.
- **Quick actions tray** – Handy buttons for copying reports, exporting data, and refreshing insights. Appears on tabs that support those actions.
- **Toasts & modals** – Success or error messages pop up near the bottom. Leadership actions often open modals for finer control (e.g., access manager, departures, player profile).

---

## Working with the Tabs

### Dashboard (🛡️)
- Snapshot summary cards show member count, season progress, recent wars, and average hero levels.
- The roster table supports sorting, filtering, and responsive cards on mobile. Use the search box or filter bar to focus on specific roles, Town Hall levels, or donation behavior.
- Clicking a member opens their profile modal for detailed stats, hero levels, and notes (permissions permitting).

### Insights (💡)
- “Snapshot & Data Health” flags the loaded clan, member count, snapshot age, and insight status.
- “Today’s Briefing” surfaces automated callouts about hero progress, donation swings, or leadership opportunities.
- “Latest Change Summary” highlights the most recent roster shifts with a quick jump to the History tab.
- “Leadership Callouts” (leaders only) ranks action items with priority badges and suggested share text.

### History (📜)
- Designed to chart departures, promotions, and other roster changes over time.
- UI polish is in progress. For now, use the quick links in Insights to review change summaries.

### Player DB (🗄️), Applicants (🎯), Discord (📢), Events (📊)
- These tabs are gradually rolling out. You may see a “coming soon” screen or a placeholder hero section.
- Once active, they’ll focus on long-term player records, applicant scoring, Discord-ready announcements, and milestone tracking respectively.

---

## Leadership Toolkit

Leaders, co-leaders, and trusted analysts unlock extra controls:

- **Command rail shortcuts** – Refresh the current snapshot, trigger a fresh ingestion job, or jump into the ingestion monitor.
- **Home clan management** – Save or switch the home clan so the dashboard auto-loads the correct roster on sign-in.
- **Access manager** – Invite new staff members, adjust roles, and revoke access.
- **Departure manager** – Review who left the clan recently and acknowledge notifications.
- **Player profiles** – Update notes, set activity overrides, and prep for coaching conversations.

Keep an eye on the role badge in the header. If you need to preview the dashboard as a lower role, use the impersonation dropdown (when available) to double-check what they can see.

---

## Staying Up to Date

- **Refresh snapshot** – Pull in the latest stored data with the “Refresh Snapshot” button in the command rail or quick actions.
- **Run ingestion** – Leaders can start a new data pull when major changes happen mid-day. Expect a short delay while the job finishes.
- **Check freshness** – The dashboard labels data as Fresh (≤24h), Stale (24–48h), or Outdated (>48h). Refresh if it’s stale before making decisions.
- **Track insights** – If headlines feel out of date, click “Refresh Insights” to regenerate coaching notes and change summaries.
- **Watch toasts** – Any failures (for example, network hiccups) show up here. Retrigger the action or contact support if it persists.

---

## Help & Troubleshooting

| Situation | What you see | Try this |
| --- | --- | --- |
| No roster after sign-in | Command rail says “No clan loaded” | Set or reload your home clan, then hit **Refresh Snapshot**. |
| Insights look old | Headlines mention stale data or the status badge says “Stale” | Click **Refresh Insights**. If it fails again, wait a moment and retry. |
| Ingestion errors | Command rail reports a failed job | Open **Monitor Jobs** for more detail, then rerun ingestion once the cause is clear. |
| Copy/export blocked | Browser warning about clipboard permissions | Allow clipboard access or choose the download option instead of copy. |
| Login loop | Sign-in succeeds but returns to the login page | Confirm your email via the Supabase link or contact an admin to check your role assignment. |

Need more help? Capture a screenshot of the toast or error message and share it with the operations team.

---

## What’s Next

- Build out the History view so change logs are fully interactive.
- Ship the Player Database, Applicants, Discord Publisher, and Events dashboards.
- Add a first-run walkthrough for new leaders and tighten accessibility (keyboard hints, contrast checks).
- Expand automated insights with war readiness and donation balance spotlights.

Feedback is welcome—leave notes in `PLANNING_NOTES.md` or message the team.

---

## Appendix A – Technical Background (Optional)

- **Snapshots & seasons** – Ingestion captures nightly roster data and tags it with a season that runs from the 1st of each month at 05:00 UTC to the next month’s 1st at 04:59:59 UTC. Season data powers the progress bar and reporting rollups.
- **Data sources** – Local development can rely on bundled JSON files; staging and production load data from Supabase projects. Production builds default to Supabase for safety.
- **Authentication & roles** – Supabase manages sign-ins. Roles (`leader`, `coleader`, `elder`, `member`, `viewer`) determine which tabs appear via leadership guards. Anonymous preview mode can impersonate a leader for demos.
- **Behind-the-scenes tools** – The ingestion monitor references job phases stored in Supabase; command rail metrics refresh every time you load or update a snapshot.

## Appendix B – Advanced Actions & Exports

- **Copy roster JSON** – Copies a structured snapshot (clan info, member stats, hero levels) for quick sharing.
- **Copy snapshot summary** – Generates a Markdown digest including war results and capital raids for Discord or email posts.
- **Download JSON/CSV** – Export the latest snapshot or war log to a file for deeper analysis.
- **Generate insights summary** – Forces a fresh automated write-up when prepping leadership briefings.
- **CLI fallback** – If web triggers fail, run `npm run ingest:run #CLANTAG` from the project root to pull data manually (leaders only).

Keep these appendices handy if you need to explain the system to technical teammates or perform advanced maintenance.
