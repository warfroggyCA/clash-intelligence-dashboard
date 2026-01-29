"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, UserPlus, Ghost, ArrowUp, ArrowDown } from 'lucide-react';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import { cn } from '@/lib/utils';

export interface LineupPlayer {
  tag: string;
  name: string;
  townHall: number | null;
  heroPower?: number | null;
  heroes?: {
    bk?: number | null;
    aq?: number | null;
    gw?: number | null;
    rc?: number | null;
    mp?: number | null;
  };
  isGhost?: boolean; // Auto-detected: in CWL but left the clan
  mapPosition?: number | null; // CWL war map position
}

export interface LineupSlot {
  position: number;
  player: LineupPlayer | null;
  isGhost?: boolean; // Ghost player who left but can't attack
  manualName?: string; // For manual entry
}

interface LineupBuilderProps {
  warSize: 15 | 30;
  availablePlayers: LineupPlayer[];
  lineup: LineupSlot[];
  onLineupChange: (lineup: LineupSlot[]) => void;
  label?: string;
}

const GHOST_PLAYER: LineupPlayer = {
  tag: '__GHOST__',
  name: '👻 Ghost (Left Clan)',
  townHall: null,
};

export default function LineupBuilder({
  warSize,
  availablePlayers,
  lineup,
  onLineupChange,
  label = 'Our Lineup',
}: LineupBuilderProps) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [manualEntryPosition, setManualEntryPosition] = useState<number | null>(null);
  const [manualName, setManualName] = useState('');
  const [dropdownFlip, setDropdownFlip] = useState(false);
  const slotRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Check if dropdown should flip upward when opening
  const handleOpenDropdown = useCallback((position: number | null) => {
    if (position === null) {
      setOpenDropdown(null);
      return;
    }
    
    const slotEl = slotRefs.current.get(position);
    if (slotEl) {
      const rect = slotEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 280; // max-h-64 = 256px + some buffer
      const stickyBarHeight = 80; // Account for sticky bottom bar
      const spaceBelow = viewportHeight - rect.bottom - stickyBarHeight;
      
      // Flip if not enough space below (accounting for sticky bar)
      setDropdownFlip(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    } else {
      setDropdownFlip(false);
    }
    
    setOpenDropdown(position);
  }, []);

  // Get players already selected (by tag)
  const selectedTags = useMemo(() => {
    return new Set(
      lineup
        .filter((slot) => slot.player && slot.player.tag !== '__GHOST__')
        .map((slot) => slot.player!.tag)
    );
  }, [lineup]);

  // Sort available players by TH desc, then hero power desc
  const sortedPlayers = useMemo(() => {
    return [...availablePlayers].sort((a, b) => {
      const thDiff = (b.townHall ?? 0) - (a.townHall ?? 0);
      if (thDiff !== 0) return thDiff;
      return (b.heroPower ?? 0) - (a.heroPower ?? 0);
    });
  }, [availablePlayers]);

  // Get available players for a specific position (excluding already selected)
  const getAvailableForPosition = useCallback(
    (position: number) => {
      const currentSlot = lineup.find((s) => s.position === position);
      const currentTag = currentSlot?.player?.tag;
      
      return sortedPlayers.filter((p) => {
        // Include if it's the currently selected player for this position
        if (p.tag === currentTag) return true;
        // Exclude if already selected elsewhere
        return !selectedTags.has(p.tag);
      });
    },
    [sortedPlayers, selectedTags, lineup]
  );

  const handleSelectPlayer = (position: number, player: LineupPlayer | null) => {
    const newLineup = lineup.map((slot) => {
      if (slot.position === position) {
        return {
          ...slot,
          player,
          isGhost: player?.tag === '__GHOST__',
          manualName: undefined,
        };
      }
      return slot;
    });
    onLineupChange(newLineup);
    setOpenDropdown(null);
  };

  const handleManualEntry = (position: number) => {
    if (!manualName.trim()) return;
    
    const newLineup = lineup.map((slot) => {
      if (slot.position === position) {
        return {
          ...slot,
          player: {
            tag: `__MANUAL_${position}__`,
            name: manualName.trim(),
            townHall: null,
          },
          isGhost: true,
          manualName: manualName.trim(),
        };
      }
      return slot;
    });
    onLineupChange(newLineup);
    setManualEntryPosition(null);
    setManualName('');
    setOpenDropdown(null);
  };

  const handleClearSlot = (position: number) => {
    const newLineup = lineup.map((slot) => {
      if (slot.position === position) {
        return { ...slot, player: null, isGhost: false, manualName: undefined };
      }
      return slot;
    });
    onLineupChange(newLineup);
  };

  // Move player up (swap with position above)
  const handleMoveUp = (position: number) => {
    if (position <= 1) return; // Can't move first position up
    
    const newLineup = [...lineup];
    const currentIndex = newLineup.findIndex(s => s.position === position);
    const aboveIndex = newLineup.findIndex(s => s.position === position - 1);
    
    if (currentIndex === -1 || aboveIndex === -1) return;
    
    // Swap players but keep positions
    const currentSlot = newLineup[currentIndex];
    const aboveSlot = newLineup[aboveIndex];
    
    newLineup[currentIndex] = { 
      ...currentSlot, 
      player: aboveSlot.player,
      isGhost: aboveSlot.isGhost,
      manualName: aboveSlot.manualName,
    };
    newLineup[aboveIndex] = { 
      ...aboveSlot, 
      player: currentSlot.player,
      isGhost: currentSlot.isGhost,
      manualName: currentSlot.manualName,
    };
    
    onLineupChange(newLineup);
  };

  // Move player down (swap with position below)
  const handleMoveDown = (position: number) => {
    if (position >= warSize) return; // Can't move last position down
    
    const newLineup = [...lineup];
    const currentIndex = newLineup.findIndex(s => s.position === position);
    const belowIndex = newLineup.findIndex(s => s.position === position + 1);
    
    if (currentIndex === -1 || belowIndex === -1) return;
    
    // Swap players but keep positions
    const currentSlot = newLineup[currentIndex];
    const belowSlot = newLineup[belowIndex];
    
    newLineup[currentIndex] = { 
      ...currentSlot, 
      player: belowSlot.player,
      isGhost: belowSlot.isGhost,
      manualName: belowSlot.manualName,
    };
    newLineup[belowIndex] = { 
      ...belowSlot, 
      player: currentSlot.player,
      isGhost: currentSlot.isGhost,
      manualName: currentSlot.manualName,
    };
    
    onLineupChange(newLineup);
  };

  // Initialize lineup if empty
  const displayLineup = useMemo(() => {
    if (lineup.length === warSize) return lineup;
    // Create empty slots
    return Array.from({ length: warSize }, (_, i) => ({
      position: i + 1,
      player: lineup.find((s) => s.position === i + 1)?.player ?? null,
      isGhost: lineup.find((s) => s.position === i + 1)?.isGhost ?? false,
      manualName: lineup.find((s) => s.position === i + 1)?.manualName,
    }));
  }, [lineup, warSize]);

  // Count filled slots
  const filledCount = displayLineup.filter((s) => s.player !== null).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        <span className={cn(
          "text-sm font-medium px-2 py-0.5 rounded-full",
          filledCount === warSize 
            ? "bg-green-500/20 text-green-400" 
            : "bg-yellow-500/20 text-yellow-400"
        )}>
          {filledCount} / {warSize}
        </span>
      </div>

      {/* Lineup Grid */}
      <div className="grid gap-2">
        {displayLineup.map((slot) => {
          const available = getAvailableForPosition(slot.position);
          const isOpen = openDropdown === slot.position;
          const showManualEntry = manualEntryPosition === slot.position;

          return (
            <div
              key={slot.position}
              className="relative"
              ref={(el) => {
                if (el) slotRefs.current.set(slot.position, el);
              }}
            >
              {/* Slot Row */}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-all cursor-pointer",
                  slot.player
                    ? (slot.isGhost || slot.player.isGhost)
                      ? "border-2 border-orange-500 bg-orange-950/30 shadow-[0_0_12px_rgba(249,115,22,0.3)]" // Ghost player - very obvious
                      : "border-white/20 bg-white/5"
                    : "border-dashed border-white/10 bg-white/[0.02] hover:border-white/20",
                  isOpen && "ring-2 ring-clash-gold/50"
                )}
                onClick={() => handleOpenDropdown(isOpen ? null : slot.position)}
              >
                {/* Position Number */}
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  (slot.player && (slot.isGhost || slot.player.isGhost))
                    ? "bg-orange-500/30 text-orange-300 ring-1 ring-orange-500/50"
                    : "bg-white/10 text-slate-300"
                )}>
                  {slot.position}
                </div>

                {/* Player Info or Empty */}
                {slot.player ? (
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    {/* Ghost indicator - either manual ghost or CWL roster ghost */}
                    {(slot.isGhost || slot.player.isGhost) ? (
                      <Ghost className="h-6 w-6 text-orange-400 flex-shrink-0 animate-pulse" />
                    ) : slot.player.townHall ? (
                      <TownHallIcon level={slot.player.townHall} size="sm" />
                    ) : null}
                    <span className={cn(
                      "font-medium truncate",
                      (slot.isGhost || slot.player.isGhost) ? "text-orange-200" : "text-white"
                    )}>
                      {slot.manualName || slot.player.name}
                    </span>
                    {/* Show warning badge for ghost players */}
                    {(slot.isGhost || slot.player.isGhost) && (
                      <span className="flex-shrink-0 rounded bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide shadow-sm">
                        👻 CAN&apos;T ATTACK
                      </span>
                    )}
                    {slot.player.heroPower && !(slot.isGhost || slot.player.isGhost) && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {slot.player.heroPower} HP
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-slate-500">
                    Select player...
                  </span>
                )}

                {/* Move / Clear / Dropdown Toggle */}
                <div className="flex items-center gap-0.5">
                  {/* Move Up/Down buttons - only show when player selected */}
                  {slot.player && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(slot.position);
                        }}
                        disabled={slot.position === 1}
                        className={cn(
                          "p-1 rounded transition-colors",
                          slot.position === 1 
                            ? "text-slate-600 cursor-not-allowed" 
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        )}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(slot.position);
                        }}
                        disabled={slot.position === warSize}
                        className={cn(
                          "p-1 rounded transition-colors",
                          slot.position === warSize 
                            ? "text-slate-600 cursor-not-allowed" 
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        )}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1" /> {/* Divider */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearSlot(slot.position);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                        title="Clear slot"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <ChevronDown className={cn(
                    "h-4 w-4 text-slate-400 transition-transform",
                    isOpen && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Dropdown - z-[200] to appear above sticky bars */}
              {isOpen && (
                <div className={cn(
                  "absolute z-[200] w-full rounded-lg border border-white/20 bg-[#1a1a2e] shadow-2xl max-h-64 overflow-y-auto",
                  dropdownFlip 
                    ? "bottom-full mb-1" // Open upward
                    : "top-full mt-1"    // Open downward (default)
                )}>
                  {/* Manual Entry Option */}
                  {showManualEntry ? (
                    <div className="p-2 border-b border-white/10">
                      <input
                        type="text"
                        placeholder="Enter player name..."
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleManualEntry(slot.position);
                          if (e.key === 'Escape') setManualEntryPosition(null);
                        }}
                        className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-clash-gold"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleManualEntry(slot.position)}
                          className="flex-1 rounded bg-clash-gold/20 px-3 py-1 text-xs font-medium text-clash-gold hover:bg-clash-gold/30"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setManualEntryPosition(null)}
                          className="flex-1 rounded bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManualEntryPosition(slot.position);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-white/5 border-b border-white/10"
                    >
                      <UserPlus className="h-4 w-4" />
                      Manual entry (ghost player)
                    </button>
                  )}

                  {/* Ghost Option */}
                  <button
                    onClick={() => handleSelectPlayer(slot.position, GHOST_PLAYER)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-white/5 border-b border-white/10"
                  >
                    <Ghost className="h-4 w-4" />
                    Ghost (placeholder - can&apos;t attack)
                  </button>

                  {/* Available Players */}
                  {available.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-500">
                      No players available
                    </div>
                  ) : (
                    available.map((player) => {
                      const isSelected = slot.player?.tag === player.tag;
                      const isGhostPlayer = player.isGhost === true;
                      return (
                        <button
                          key={player.tag}
                          onClick={() => handleSelectPlayer(slot.position, player)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors",
                            isSelected && "bg-clash-gold/10",
                            isGhostPlayer && "bg-orange-950/40 border-l-4 border-orange-500"
                          )}
                        >
                          {isGhostPlayer ? (
                            <Ghost className="h-5 w-5 text-orange-400 flex-shrink-0 animate-pulse" />
                          ) : player.townHall ? (
                            <TownHallIcon level={player.townHall} size="sm" />
                          ) : (
                            <div className="w-5" />
                          )}
                          <span className={cn(
                            "flex-1 text-left truncate",
                            isGhostPlayer ? "text-orange-300" : "text-white"
                          )}>
                            {player.name}
                          </span>
                          {isGhostPlayer && (
                            <span className="flex-shrink-0 rounded bg-orange-500/30 px-1.5 py-0.5 text-[10px] font-bold text-orange-300 uppercase">
                              👻 LEFT
                            </span>
                          )}
                          {player.heroPower && !isGhostPlayer && (
                            <span className="text-xs text-slate-400">
                              {player.heroPower} HP
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-xs text-clash-gold">✓</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

