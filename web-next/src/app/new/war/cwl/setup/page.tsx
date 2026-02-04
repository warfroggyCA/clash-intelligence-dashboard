"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import Card from "@/components/new-ui/Card";
import { Button } from "@/components/new-ui/Button";
import CwlStepBar from "@/components/war/CwlStepBar";
import type { CwlDayOpponent } from "../cwl-data";
import { sampleSeasonSummary } from "../cwl-data";
import { normalizeTag, isValidTag, sanitizeInputTag } from "@/lib/tags";
import { useRosterData } from "@/app/new/roster/useRosterData";

const blankOpponents: CwlDayOpponent[] = Array.from({ length: 7 }, (_, idx) => ({
  dayIndex: idx + 1,
  clanTag: "",
  clanName: "",
  status: "not_loaded",
}));

const statusTone: Record<string, string> = {
  not_loaded: "text-slate-300",
  roster_loaded: "text-emerald-300",
  war_finished: "text-amber-300",
  saved: "text-emerald-300",
  partial: "text-amber-200",
};

const statusLabel: Record<string, string> = {
  not_loaded: "Not loaded",
  roster_loaded: "Roster loaded",
  war_finished: "War finished",
  saved: "Saved",
  partial: "Lineup saved",
};

export default function CwlSetupPage() {
  const seasonId = sampleSeasonSummary.seasonId;
  const [warSize, setWarSize] = useState<15 | 30>(sampleSeasonSummary.warSize);
  const [warSizeSaving, setWarSizeSaving] = useState(false);
  const [warSizeSavedAt, setWarSizeSavedAt] = useState<string | null>(null);
  const [seasonLabel, setSeasonLabel] = useState(sampleSeasonSummary.seasonLabel);
  const [labelSaving, setLabelSaving] = useState(false);
  const [labelSavedAt, setLabelSavedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<CwlDayOpponent[]>(blankOpponents);
  const [lineupMap, setLineupMap] = useState<Record<number, boolean>>({});
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [savingOpponents, setSavingOpponents] = useState(false);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [copyAllLoading, setCopyAllLoading] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [eligibleSet, setEligibleSet] = useState<Set<string> | null>(null);
  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();

  const fetchSeason = useCallback(async () => {
    try {
      const res = await fetch(`/api/cwl/season?seasonId=${seasonId}`);
      if (!res.ok) return;
      const body = await res.json();
      const size = Number(body?.data?.war_size);
      const label = body?.data?.season_label;
      if (size === 15 || size === 30) {
        setWarSize((prev) => (size !== prev ? size : prev));
      }
      if (label) {
        setSeasonLabel((prev) => (label !== prev ? label : prev));
      }
    } catch {
      // ignore
    }
  }, [seasonId]);

  const fetchOpponents = useCallback(async () => {
    setLoadingOpponents(true);
    setOpponentError(null);
    try {
      const res = await fetch(`/api/cwl/opponents?seasonId=${seasonId}&warSize=${warSize}`);
      if (!res.ok) throw new Error("Failed to load opponents");
      const body = await res.json();
      const data = body?.data as any[] | undefined;
      if (data && data.length) {
        const mapped = data.map((row) => ({
          dayIndex: row.day_index ?? row.dayIndex ?? 0,
          clanTag: row.opponent_tag ?? row.clanTag ?? "",
          clanName: row.opponent_name ?? row.clanName ?? "",
          status: (row.status as any) ?? "not_loaded",
          note: row.note ?? "",
        }));
        const mappedByDay = new Map(mapped.map((row) => [row.dayIndex, row]));
        setRows(blankOpponents.map((row) => mappedByDay.get(row.dayIndex) ?? row));
      } else {
        setRows(blankOpponents);
      }
    } catch (err: any) {
      setOpponentError(err?.message || "Failed to load opponents");
    } finally {
      setLoadingOpponents(false);
    }
  }, [seasonId, warSize]);

  const fetchEligible = useCallback(async () => {
    try {
      const res = await fetch(`/api/cwl/eligible?seasonId=${seasonId}&warSize=${warSize}`);
      if (!res.ok) return;
      const body = await res.json();
      const data = body?.data as any[] | undefined;
      const set = data?.length ? new Set(data.map((row) => normalizeTag(row.player_tag))) : new Set<string>();
      setEligibleSet(set);
      setEligibleCount(set.size);
    } catch {
      // ignore
    }
  }, [seasonId, warSize]);

  useEffect(() => {
    const fetchLineups = async () => {
      try {
        const res = await fetch(`/api/cwl/lineup?seasonId=${seasonId}&warSize=${warSize}`);
        if (res.ok) {
          const body = await res.json();
          const data = body?.data as any[] | undefined;
          if (data?.length) {
            const map: Record<number, boolean> = {};
            data.forEach((row) => {
              const hasOur = Array.isArray(row.our_lineup) && row.our_lineup.length > 0;
              map[row.day_index] = hasOur;
            });
            setLineupMap(map);
          } else {
            setLineupMap({});
          }
        }
      } catch {
        // ignore
      }
    };
    fetchLineups();
  }, [seasonId, warSize]);

  useEffect(() => {
    fetchSeason();
  }, [fetchSeason]);

  useEffect(() => {
    fetchOpponents();
  }, [fetchOpponents]);

  useEffect(() => {
    fetchEligible();
  }, [fetchEligible]);

  const allValid = useMemo(() => rows.every((row) => isValidTag(row.clanTag)), [rows]);
  const rosterCount = eligibleCount ?? 0;
  const rosterReady = rosterCount >= warSize;

  const updateTag = (dayIndex: number, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.dayIndex === dayIndex
          ? { ...row, clanTag: sanitizeInputTag(value), clanName: "" }
          : row,
      ),
    );
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

  const saveOpponents = async () => {
    if (!allValid) {
      setOpponentError("Enter all 7 opponent tags before saving.");
      return;
    }
    setSavingOpponents(true);
    setOpponentError(null);
    const normalized = rows.map((row) => ({
      ...row,
      clanTag: normalizeTag(row.clanTag),
    }));

    const withNames = await Promise.all(
      normalized.map(async (row) => {
        const name = await fetchClanName(row.clanTag);
        return { ...row, clanName: name || row.clanName || "—" };
      }),
    );

    try {
      const res = await fetch("/api/cwl/opponents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId,
          warSize,
          opponents: withNames.map((row) => ({
            dayIndex: row.dayIndex,
            opponentTag: row.clanTag,
            opponentName: row.clanName,
            thDistribution: null,
            rosterSnapshot: null,
            fetchedAt: null,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save opponents");
      const sorted = [...withNames].sort((a, b) => a.dayIndex - b.dayIndex);
      setRows(sorted);
    } catch (err: any) {
      setOpponentError(err?.message || "Failed to save opponents");
    } finally {
      setSavingOpponents(false);
    }
  };

  const copyFullWeek = async () => {
    setCopyAllLoading(true);
    try {
      const validOpponents = rows.filter((r) => isValidTag(r.clanTag));
      const opponentData = await Promise.all(
        validOpponents.map(async (opp) => {
          try {
            const res = await fetch(`/api/war/opponent?opponentTag=${encodeURIComponent(opp.clanTag)}&enrich=50`);
            if (!res.ok) throw new Error("fetch failed");
            const body = await res.json();
            return {
              day: opp.dayIndex,
              clanTag: opp.clanTag,
              clanName: body?.data?.clan?.name || opp.clanName || "Unknown",
              thDistribution: body?.data?.thDistribution || {},
              roster: body?.data?.roster || [],
            };
          } catch {
            return {
              day: opp.dayIndex,
              clanTag: opp.clanTag,
              clanName: opp.clanName || "Unknown",
              thDistribution: {},
              roster: [],
            };
          }
        }),
      );

      const ourRoster = (rosterMembers && rosterMembers.length ? rosterMembers : [])
        .map((m) => ({
          name: m.name || m.tag,
          tag: normalizeTag(m.tag || ""),
          th: m.townHallLevel ?? (m as any).th ?? null,
          heroes: {
            bk: m.bk ?? null,
            aq: m.aq ?? null,
            gw: m.gw ?? null,
            rc: m.rc ?? null,
            mp: m.mp ?? null,
          },
          heroPower: m.heroPower ?? null,
        }))
        .filter((m) => !eligibleSet || eligibleSet.has(m.tag));

      const attendanceLines: string[] = [];
      try {
        const res = await fetch(`/api/cwl/attendance?seasonId=${seasonId}`);
        const body = await res.json().catch(() => null);
        const data = body?.data;
        if (res.ok && data) {
          const targetDay = data?.targetDayIndex;
          const priorDays = Array.isArray(data?.priorDays) ? data.priorDays : [];
          const priorRange = priorDays.length === 1
            ? `Day ${priorDays[0]}`
            : priorDays.length > 1
              ? `Days ${priorDays[0]}-${priorDays[priorDays.length - 1]}`
              : 'Prior Days';
          attendanceLines.push(`Forward lineup signals (Day ${targetDay})`);
          if (!Array.isArray(data?.daysWithData) || data.daysWithData.length === 0) {
            attendanceLines.push(`- No stored attendance yet to inform Day ${targetDay}.`);
          } else {
            attendanceLines.push(`- Based on stored attendance through ${priorRange}.`);
            if (Array.isArray(data?.missingDays) && data.missingDays.length) {
              attendanceLines.push(`- Missing data for day(s): ${data.missingDays.join(', ')}`);
            }
            const noShow = Array.isArray(data?.noShows) ? data.noShows : [];
            const risk = Array.isArray(data?.missedAttacks) ? data.missedAttacks : [];
            const reliable = Array.isArray(data?.players)
              ? data.players.filter((p: any) => p.status === 'reliable')
              : [];
            if (noShow.length) {
              attendanceLines.push(`No-shows so far (bench unless needed):`);
              noShow.forEach((row: any) => {
                const displayName = row.name || row.tag;
                attendanceLines.push(`- ${displayName} (${row.tag})`);
              });
            }
            if (risk.length) {
              attendanceLines.push(`Risk list (missed attacks earlier):`);
              risk.forEach((row: any) => {
                const displayName = row.name || row.tag;
                attendanceLines.push(`- ${displayName} (${row.tag})`);
              });
            }
            if (reliable.length) {
              attendanceLines.push(`Reliable (attacked every prior day):`);
              reliable.forEach((row: any) => {
                const displayName = row.name || row.tag;
                attendanceLines.push(`- ${displayName} (${row.tag})`);
              });
            }
          }
        }
      } catch {
        // ignore
      }

      const payloadLines = [
        `CWL week export • war size ${warSize}v${warSize}`,
        "",
        "Our eligible roster (include alts if you know them):",
        JSON.stringify(ourRoster, null, 2),
        "",
        "Opponents by day:",
        JSON.stringify(opponentData, null, 2),
      ];

      if (attendanceLines.length) {
        payloadLines.push("", ...attendanceLines);
      }

      payloadLines.push(
        "",
        "Notes: enforce fairness across alts, rotate across 7 days, and propose daily matchups based on TH + heroes.",
      );

      const payload = payloadLines.join("\n");

      const { copyToClipboard } = await import('@/lib/export-utils');
      await copyToClipboard(payload);
    } catch {
      // swallow
    } finally {
      setCopyAllLoading(false);
    }
  };

  const resetCwl = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Reset CWL for this season? This clears opponents, season roster, lineups, and results.",
      );
      if (!confirmed) return;
    }
    setResetting(true);
    setResetNotice(null);
    setOpponentError(null);
    try {
      const res = await fetch("/api/cwl/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });
      if (!res.ok) throw new Error("Failed to reset CWL");
      setRows(blankOpponents);
      setEligibleCount(0);
      setEligibleSet(new Set());
      setLineupMap({});
      setResetNotice("CWL reset. Opponents, roster, and lineups cleared.");
      if (typeof window !== "undefined") {
        const lineupPrefix = `cwl_lineup_cache_${seasonId}_${warSize}_`;
        const opponentPrefix = `cwl_opponents_cache_${seasonId}_${warSize}`;
        const stepPrefix = `cwl_day_step_${seasonId}_${warSize}_`;
        Object.keys(localStorage || {}).forEach((key) => {
          if (key.startsWith(lineupPrefix) || key.startsWith(opponentPrefix)) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage || {}).forEach((key) => {
          if (key.startsWith(stepPrefix)) sessionStorage.removeItem(key);
        });
      }
    } catch (err: any) {
      setResetNotice(err?.message || "Failed to reset CWL");
    } finally {
      setResetting(false);
    }
  };

  const saveSeasonLabel = async () => {
    if (!seasonLabel.trim()) return;
    setLabelSaving(true);
    try {
      await fetch("/api/cwl/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, warSize, seasonLabel }),
      });
      setLabelSavedAt(new Date().toLocaleTimeString());
    } catch {
      // ignore
    } finally {
      setLabelSaving(false);
    }
  };

  const handleLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveSeasonLabel();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            CWL Setup
          </h1>
          <p className="text-slate-300 text-sm">
            One home for setup and the CWL weekly hub: war size, roster, and opponent planning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/new/war/cwl/roster">
            <Button tone="ghost">Season roster</Button>
          </Link>
          <Link href="/new/war/cwl/day/1">
            <Button>Go to Day 1</Button>
          </Link>
        </div>
      </div>

      <CwlStepBar current="setup" />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Step 1 • Season setup">
          <div className="space-y-3 text-sm text-slate-200">
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-[0.2em]">Season label</div>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className="w-full min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  placeholder={`CWL ${seasonId}`}
                />
                <div className="text-xs text-slate-500">Press Enter to save.</div>
              </div>
              {labelSavedAt ? <div className="text-xs text-slate-500 mt-1">Saved {labelSavedAt}</div> : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">League</span>
              <span className="font-semibold text-white">{sampleSeasonSummary.league || '—'}</span>
            </div>
            <div className="text-slate-400">Choose the CWL format.</div>
            <div className="flex items-center gap-2">
              {[15, 30].map((size) => (
                <Button
                  key={size}
                  tone={warSize === size ? "primary" : "ghost"}
                  className="text-xs px-3"
                  disabled={warSizeSaving}
                  onClick={async () => {
                    if (warSize === size) return;
                    setWarSize(size as 15 | 30);
                    setWarSizeSaving(true);
                    try {
                      await fetch("/api/cwl/season", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ seasonId, warSize: size }),
                      });
                      setWarSizeSavedAt(new Date().toLocaleTimeString());
                    } catch {
                      // ignore
                    } finally {
                      setWarSizeSaving(false);
                    }
                  }}
                >
                  {size}v{size}
                </Button>
              ))}
              {warSizeSaving ? <span className="text-xs text-slate-500">Saving…</span> : null}
            </div>
            {warSizeSavedAt ? <div className="text-xs text-slate-500">Saved {warSizeSavedAt}</div> : null}
          </div>
        </Card>

        <Card title="Step 2 • Season roster">
          <div className="space-y-3 text-sm text-slate-200">
            <div className="text-xs text-slate-500">Next: pick the weekly eligible roster.</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Eligible selected</span>
              <span className="font-semibold text-white">{rosterCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">War size</span>
              <span className="font-semibold text-white">{warSize}</span>
            </div>
            {!rosterReady ? (
              <div className="text-xs text-amber-300">Select at least {warSize} for the season roster.</div>
            ) : null}
            <Link href="/new/war/cwl/roster">
              <Button tone="ghost" className="w-full justify-center text-sm">Set season roster</Button>
            </Link>
            {rosterLoading ? <div className="text-xs text-slate-500">Loading roster…</div> : null}
            {rosterMembers?.length ? (
              <div className="text-xs text-slate-500">{rosterMembers.length} players in current roster.</div>
            ) : null}
          </div>
        </Card>

        <Card title="Setup checklist">
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">War size set</span>
              <span className="font-semibold text-white">{warSize}v{warSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Season roster</span>
              <span className={`font-semibold ${rosterReady ? "text-emerald-300" : "text-amber-300"}`}>
                {rosterReady ? "Ready" : "Needs players"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Opponents</span>
              <span className={`font-semibold ${allValid ? "text-emerald-300" : "text-amber-300"}`}>
                {allValid ? "Complete" : "Missing tags"}
              </span>
            </div>
            <div className="text-xs text-slate-400">Complete all three before Day 1 planning.</div>
          </div>
        </Card>

        <Card title="Quick actions">
          <div className="space-y-2 text-sm text-slate-200">
            <Link href="/new/war/cwl/roster">
              <Button className="w-full justify-center">Set season roster</Button>
            </Link>
            <Button
              tone="ghost"
              className="w-full justify-center"
              onClick={copyFullWeek}
              disabled={copyAllLoading || !allValid}
            >
              {copyAllLoading ? "Building AI prompt…" : "Copy AI prompt (no auto‑send)"}
            </Button>
            <div className="text-xs text-slate-500">
              Copies roster + opponents to your clipboard for use in ChatGPT or another LLM.
            </div>
          </div>
        </Card>
      </div>

      <Card title="Opponent clans (Day 1–7)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 text-xs uppercase tracking-[0.2em]">
              <tr>
                <th className="py-2">Day</th>
                <th className="py-2">Opponent tag</th>
                <th className="py-2">Clan name</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingOpponents && rows.length === 0 ? (
                <tr><td className="py-3 text-slate-400" colSpan={5}>Loading opponents…</td></tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.dayIndex} className="hover:bg-white/5">
                  <td className="py-2 font-semibold text-white">Day {row.dayIndex}</td>
                  <td className="py-2">
                    <input
                      className="w-full rounded-md border bg-transparent px-2 py-1 text-white uppercase"
                      style={{ borderColor: row.clanTag && !isValidTag(row.clanTag) ? "#f59e0b" : "var(--border-subtle)" }}
                      value={row.clanTag}
                      onChange={(e) => updateTag(row.dayIndex, e.target.value)}
                      placeholder="#TAG"
                    />
                    {row.clanTag && !isValidTag(row.clanTag) ? (
                      <div className="text-xs text-amber-300">Use format #TAG</div>
                    ) : null}
                  </td>
                  <td className="py-2 text-slate-200">{row.clanName || "—"}</td>
                  <td className="py-2">
                    {(() => {
                      const hasLineup = lineupMap[row.dayIndex];
                      const statusKey = hasLineup ? "partial" : row.clanTag ? "saved" : row.status;
                      return (
                        <>
                          <span className={`font-semibold ${statusTone[statusKey] || statusTone.not_loaded}`}>
                            {statusLabel[statusKey] || statusLabel.not_loaded}
                          </span>
                          {row.note ? <span className="ml-2 text-slate-500 text-xs">{row.note}</span> : null}
                        </>
                      );
                    })()}
                  </td>
                  <td className="py-2 text-right">
                    {isValidTag(row.clanTag) ? (
                      <Link href={`/new/war/cwl/day/${row.dayIndex}`}>
                        <Button tone="ghost" className="text-sm">
                          Open planner
                        </Button>
                      </Link>
                    ) : (
                      <Button tone="ghost" className="text-sm" disabled>
                        Open planner
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={saveOpponents} disabled={!allValid || savingOpponents}>
            {savingOpponents ? "Saving…" : "Save opponents"}
          </Button>
          <Button tone="ghost" onClick={fetchOpponents} disabled={loadingOpponents}>
            {loadingOpponents ? "Refreshing…" : "Reload from server"}
          </Button>
          {!allValid ? (
            <span className="text-xs text-amber-300">Enter valid tags for all 7 days to save.</span>
          ) : null}
        </div>
        {opponentError ? <div className="mt-2 text-xs text-amber-300">{opponentError}</div> : null}
      </Card>

      <Card title="Reset CWL">
        <div className="space-y-3 text-sm text-slate-200">
          <p className="text-slate-400">
            Use this to start the season fresh. This clears opponents, season roster selections, daily lineups,
            and stored results for this season.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="danger" onClick={resetCwl} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset CWL"}
            </Button>
            <span className="text-xs text-slate-500">Confirmation required.</span>
          </div>
          {resetNotice ? <div className="text-xs text-amber-300">{resetNotice}</div> : null}
        </div>
      </Card>
    </div>
  );
}
