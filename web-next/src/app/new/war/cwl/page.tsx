"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import type { CwlDayOpponent } from './cwl-data';
import { sampleSeasonSummary, sampleOpponents } from './cwl-data';
import { normalizeTag, isValidTag, sanitizeInputTag } from '@/lib/tags';
import { useRosterData } from '@/app/new/roster/useRosterData';

const statusTone: Record<string, string> = {
  not_loaded: 'text-slate-300',
  roster_loaded: 'text-emerald-300',
  war_finished: 'text-amber-300',
  saved: 'text-emerald-300',
  partial: 'text-amber-200',
};

const statusLabel: Record<string, string> = {
  not_loaded: 'Not loaded',
  roster_loaded: 'Roster loaded',
  war_finished: 'War finished',
  saved: 'Saved',
  partial: 'Lineup saved',
};

export default function CwlOverviewPage() {
  const season = sampleSeasonSummary;
  const [rows, setRows] = useState<CwlDayOpponent[]>(sampleOpponents);
  const [draft, setDraft] = useState<CwlDayOpponent[]>(sampleOpponents);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyAllLoading, setCopyAllLoading] = useState(false);
  const { members: rosterMembers } = useRosterData();
  const [lineupMap, setLineupMap] = useState<Record<number, boolean>>({});
  const STORAGE_KEY = 'cwl_opponents_v1';

  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        const res = await fetch(`/api/cwl/opponents?seasonId=${season.seasonId}&warSize=${season.warSize}`);
        if (res.ok) {
          const body = await res.json();
          if (body?.data?.length) {
            setRows(body.data);
            setDraft(body.data);
            return;
          }
        }
      } catch {
        // ignore
      }
      // fallback to local if server empty
      if (typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as CwlDayOpponent[];
            if (Array.isArray(parsed) && parsed.length) {
              setRows(parsed);
              setDraft(parsed);
            }
          }
        } catch {
          // ignore
        }
      }
    };
    fetchOpponents();
  }, [season.seasonId, season.warSize]);

  useEffect(() => {
    const fetchLineups = async () => {
      try {
        const res = await fetch(`/api/cwl/lineup?seasonId=${season.seasonId}&warSize=${season.warSize}`);
        if (res.ok) {
          const body = await res.json();
          const rows = body?.data as any[] | undefined;
          if (rows?.length) {
            const map: Record<number, boolean> = {};
            rows.forEach((r) => {
              const hasOur = Array.isArray(r.our_lineup) && r.our_lineup.length > 0;
              map[r.day_index] = hasOur;
            });
            setLineupMap(map);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchLineups();
  }, [season.seasonId, season.warSize, rows]);

  const allValid = useMemo(() => draft.every((row) => isValidTag(row.clanTag)), [draft]);

  const startEdit = () => {
    setDraft(rows);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(rows);
    setEditing(false);
  };

  const fetchClanName = async (tag: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/war/opponent?opponentTag=${encodeURIComponent(tag)}`);
      if (!res.ok) return null;
      const body = await res.json();
      return body?.data?.clan?.name ?? null;
    } catch {
      return null;
    }
  };

  const saveEdit = async () => {
    if (!allValid) return;
    setSaving(true);
    const normalized = draft.map((row) => ({
      ...row,
      clanTag: normalizeTag(row.clanTag),
    }));

    const withNames = await Promise.all(
      normalized.map(async (row) => {
        const name = await fetchClanName(row.clanTag);
        return { ...row, clanName: name || row.clanName || '—' };
      }),
    );

    try {
      await fetch('/api/cwl/opponents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: season.seasonId,
          warSize: season.warSize,
          opponents: withNames.map((w) => ({
            dayIndex: w.dayIndex,
            opponentTag: w.clanTag,
            opponentName: w.clanName,
            thDistribution: null,
            rosterSnapshot: null,
            fetchedAt: null,
          })),
        }),
      });
    } catch {
      // ignore
    }

    setRows(withNames);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withNames));
      } catch (err) {
        // ignore storage errors
      }
    }
    setEditing(false);
    setSaving(false);
  };

  const updateTag = (dayIndex: number, value: string) => {
    setDraft((prev) =>
      prev.map((row) =>
        row.dayIndex === dayIndex ? { ...row, clanTag: value } : row,
      ),
    );
  };

  const copyFullWeek = async () => {
    setCopyAllLoading(true);
    try {
      const validOpponents = rows.filter((r) => isValidTag(r.clanTag));
      const opponentData = await Promise.all(
        validOpponents.map(async (opp) => {
          try {
            const res = await fetch(`/api/war/opponent?opponentTag=${encodeURIComponent(opp.clanTag)}&enrich=50`);
            if (!res.ok) throw new Error('fetch failed');
            const body = await res.json();
            return {
              day: opp.dayIndex,
              clanTag: opp.clanTag,
              clanName: body?.data?.clan?.name || opp.clanName || 'Unknown',
              thDistribution: body?.data?.thDistribution || {},
              roster: body?.data?.roster || [],
            };
          } catch {
            return {
              day: opp.dayIndex,
              clanTag: opp.clanTag,
              clanName: opp.clanName || 'Unknown',
              thDistribution: {},
              roster: [],
            };
          }
        }),
      );

      const eligiblePool = (() => {
        if (typeof window === 'undefined') return null;
        try {
          const stored = window.localStorage.getItem('cwl_roster_selection_v1');
          if (!stored) return null;
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.selected)) {
            return new Set(parsed.selected.map((t: string) => normalizeTag(t)));
          }
        } catch {
          return null;
        }
        return null;
      })();

      const ourRoster = (rosterMembers && rosterMembers.length ? rosterMembers : [])
        .map((m) => ({
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ''),
          th: m.townHallLevel ?? (m as any).th ?? 0,
          heroes: {
            bk: m.bk ?? null,
            aq: m.aq ?? null,
            gw: m.gw ?? null,
            rc: m.rc ?? null,
            mp: m.mp ?? null,
          },
          heroPower: (m.bk ?? 0) + (m.aq ?? 0) + (m.gw ?? 0) + (m.rc ?? 0) + (m.mp ?? 0),
        }))
        .filter((m) => !eligiblePool || eligiblePool.has(m.tag));

      const payload = [
        `CWL week export • war size ${season.warSize}v${season.warSize}`,
        '',
        'Our eligible roster (include alts if you know them):',
        JSON.stringify(ourRoster, null, 2),
        '',
        'Opponents by day:',
        JSON.stringify(opponentData, null, 2),
        '',
        'Notes: enforce fairness across alts, rotate across 7 days, and propose daily matchups based on TH + heroes.',
      ].join('\n');

      await navigator.clipboard.writeText(payload);
    } catch (err) {
      // swallow
    } finally {
      setCopyAllLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>CWL Season Overview</h1>
          <p className="text-slate-300 text-sm">Stay on top of the 7 CWL war days: opponents, roster status, and quick links.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/new/war/cwl/roster">
            <Button>Manage season roster</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Season">
          <div className="space-y-1 text-sm text-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-400">Label</span>
              <span className="font-semibold text-white">{season.seasonLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">League</span>
              <span className="font-semibold text-white">{season.league}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">War size</span>
              <span className="font-semibold text-white">{season.warSize}v{season.warSize}</span>
            </div>
          </div>
        </Card>

        <Card title="Roster status">
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Selected</span>
              <span className="font-semibold text-white">{season.rosterSelected} / {season.warSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Lock</span>
              <span className={`font-semibold ${season.rosterLocked ? 'text-emerald-300' : 'text-amber-200'}`}>
                {season.rosterLocked ? 'Locked' : 'Not locked'}
              </span>
            </div>
            <Link href="/new/war/cwl/roster">
              <Button variant="outline" size="sm" className="w-full justify-center">Open roster</Button>
            </Link>
          </div>
        </Card>

        <Card title="Quick actions">
          <div className="space-y-2 text-sm text-slate-200">
            <Link href="/new/war/cwl/day/1">
              <Button className="w-full justify-center">Open Day 1 planner</Button>
            </Link>
            <Link href="/new/war/cwl/roster">
              <Button variant="outline" className="w-full justify-center">Set season roster</Button>
            </Link>
            <Button variant="outline" className="w-full justify-center" onClick={copyFullWeek} disabled={copyAllLoading || !rows.every((r) => isValidTag(r.clanTag))}>
              {copyAllLoading ? 'Building full-week export…' : 'Copy full-week AI export'}
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Opponents (Day 1–7)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="py-2">Day</th>
                <th className="py-2">Opponent</th>
                <th className="py-2">Tag</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((opp) => {
                const draftRow = draft.find((d) => d.dayIndex === opp.dayIndex) ?? opp;
                const tagDisplay = editing ? draftRow.clanTag : opp.clanTag;
                const nameDisplay = editing ? draftRow.clanName : opp.clanName;
                const tagIsValid = tagDisplay ? isValidTag(tagDisplay) : false;
                const hasLineup = lineupMap[opp.dayIndex];
                const statusKey = hasLineup ? 'partial' : (tagDisplay ? 'saved' : opp.status);
                return (
                <tr key={opp.dayIndex} className="hover:bg-white/5">
                  <td className="py-2 font-semibold text-white">Day {opp.dayIndex}</td>
                  <td className="py-2 text-slate-200">
                    {nameDisplay || '—'}
                  </td>
                  <td className="py-2 text-slate-400">
                    {editing ? (
                      <input
                        className="w-full rounded-md border bg-transparent px-2 py-1 text-white uppercase"
                        style={{ borderColor: tagIsValid ? 'var(--border-subtle)' : '#f59e0b' }}
                        value={tagDisplay}
                        onChange={(e) => updateTag(opp.dayIndex, sanitizeInputTag(e.target.value))}
                        placeholder="#TAG"
                      />
                    ) : (
                      tagDisplay
                    )}
                  </td>
                  <td className="py-2">
                    <span className={`font-semibold ${statusTone[statusKey] || statusTone.not_loaded}`}>{statusLabel[statusKey] || statusLabel.not_loaded}</span>
                    {opp.note ? <span className="ml-2 text-slate-500 text-xs">{opp.note}</span> : null}
                    {editing && !tagIsValid ? (
                      <div className="text-xs text-amber-300">Use format #TAG</div>
                    ) : null}
                  </td>
                  <td className="py-2 text-right">
                    {editing ? (
                      <span className="text-slate-500 text-xs">Save to enable</span>
                    ) : (
                      <Link href={`/new/war/cwl/day/${opp.dayIndex}`}>
                        <Button variant="outline" size="sm" disabled={!opp.clanTag}>Open planner</Button>
                      </Link>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button onClick={saveEdit} disabled={!allValid || saving}>
                {saving ? 'Saving…' : 'Save opponents'}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
              {!allValid ? <span className="text-xs text-amber-300">Enter valid tags for all 7 days to save (we normalize # automatically).</span> : null}
            </>
          ) : (
            <Button variant="outline" onClick={startEdit}>Edit opponents</Button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">Enter all 7 opponent tags once per season. Names will refresh from the API after the tag is saved.</p>
      </Card>
    </div>
  );
}
