'use client';

import { useState, useMemo, useEffect } from 'react';
import { Eye, EyeOff, MessageSquare, Download, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { GlassCard, Button } from '@/components/ui';
import type { Member } from '@/types';
import { 
  formatWatchlistForDiscord, 
  exportWatchlistToCSV, 
  copyToClipboard, 
  downloadCSV 
} from '@/lib/export-utils';

interface WatchlistItem {
  member: Member;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  addedAt?: Date;
  snoozedUntil?: Date;
  notes?: string;
}

interface WatchlistManagerProps {
  watchlist: WatchlistItem[];
  onUpdateWatchlist?: (watchlist: WatchlistItem[]) => void;
}

export const WatchlistManager = ({ watchlist, onUpdateWatchlist }: WatchlistManagerProps) => {
  const [internalWatchlist, setInternalWatchlist] = useState<WatchlistItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Initialize internal watchlist from prop only once
  useEffect(() => {
    if (internalWatchlist.length === 0 && watchlist.length > 0) {
      setInternalWatchlist(watchlist);
    }
  }, [internalWatchlist.length, watchlist]);

  // Use internal watchlist if available, otherwise use prop
  const activeWatchlistData = internalWatchlist.length > 0 ? internalWatchlist : watchlist;

  const activeWatchlist = useMemo(() => {
    return activeWatchlistData.filter(item => {
      if (!item.snoozedUntil) return true;
      return new Date(item.snoozedUntil) < new Date();
    });
  }, [activeWatchlistData]);

  const snoozedWatchlist = useMemo(() => {
    return activeWatchlistData.filter(item => {
      if (!item.snoozedUntil) return false;
      return new Date(item.snoozedUntil) >= new Date();
    });
  }, [activeWatchlistData]);

  const handleCopyDiscord = async () => {
    const formatted = formatWatchlistForDiscord(activeWatchlist);
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadCSV = () => {
    const csv = exportWatchlistToCSV(activeWatchlist);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(`watchlist-${date}.csv`, csv);
  };

  const handleSnooze = (memberTag: string, days: number) => {
    const updated = activeWatchlistData.map(item => {
      if (item.member.tag === memberTag) {
        const snoozedUntil = new Date();
        snoozedUntil.setDate(snoozedUntil.getDate() + days);
        return { ...item, snoozedUntil };
      }
      return item;
    });
    setInternalWatchlist(updated);
    onUpdateWatchlist?.(updated);
  };

  const handleUnsnooze = (memberTag: string) => {
    const updated = activeWatchlistData.map(item => {
      if (item.member.tag === memberTag) {
        return { ...item, snoozedUntil: undefined };
      }
      return item;
    });
    setInternalWatchlist(updated);
    onUpdateWatchlist?.(updated);
  };

  const handleRemove = (memberTag: string) => {
    const updated = activeWatchlistData.filter(item => item.member.tag !== memberTag);
    setInternalWatchlist(updated);
    onUpdateWatchlist?.(updated);
  };

  const handleSaveNotes = (memberTag: string) => {
    const updated = activeWatchlistData.map(item => {
      if (item.member.tag === memberTag) {
        return { ...item, notes: noteText };
      }
      return item;
    });
    setInternalWatchlist(updated);
    onUpdateWatchlist?.(updated);
    setEditingNotes(null);
    setNoteText('');
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500/50';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  if (activeWatchlist.length === 0 && snoozedWatchlist.length === 0) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-gray-100">Watchlist</h2>
        </div>
        <p className="text-gray-400 text-center py-8">
          ✅ All members performing well! No one on the watchlist.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-gray-100">Watchlist</h2>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm font-semibold">
            {activeWatchlist.length} Active
          </span>
          {snoozedWatchlist.length > 0 && (
            <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-semibold">
              {snoozedWatchlist.length} Snoozed
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyDiscord}
            className="min-h-[44px]"
            aria-label="Copy as Discord message"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Copy Discord
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCSV}
            className="min-h-[44px]"
            aria-label="Download as CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Active Watchlist */}
      {activeWatchlist.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Active Monitoring ({activeWatchlist.length})
          </h3>
          {activeWatchlist.map((item) => {
            const isExpanded = expandedMember === item.member.tag;
            const isEditingNote = editingNotes === item.member.tag;
            
            return (
              <div
                key={item.member.tag}
                className={`bg-brand-surfaceRaised border rounded-lg p-4 transition-all ${getSeverityColor(item.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl">{getSeverityIcon(item.severity)}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-100">{item.member.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{item.reason}</p>
                      {item.notes && !isEditingNote && (
                        <p className="text-sm text-gray-300 mt-2 italic">
                          📝 {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setExpandedMember(isExpanded ? null : item.member.tag)}
                    className="text-sm text-gray-400 hover:text-gray-200 transition"
                  >
                    {isExpanded ? 'Less' : 'More'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                    {/* Notes */}
                    {isEditingNote ? (
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">Add Notes:</label>
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full bg-brand-surface border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm"
                          rows={2}
                          placeholder="Add notes about this player..."
                        />
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => handleSaveNotes(item.member.tag)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingNotes(item.member.tag);
                          setNoteText(item.notes || '');
                        }}
                        className="min-h-[44px]"
                      >
                        📝 {item.notes ? 'Edit Notes' : 'Add Notes'}
                      </Button>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSnooze(item.member.tag, 3)}
                        className="min-h-[44px]"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Snooze 3d
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSnooze(item.member.tag, 7)}
                        className="min-h-[44px]"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Snooze 7d
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemove(item.member.tag)}
                        className="min-h-[44px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Snoozed Watchlist */}
      {snoozedWatchlist.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
            <EyeOff className="w-4 h-4" />
            Snoozed ({snoozedWatchlist.length})
          </h3>
          {snoozedWatchlist.map((item) => (
            <div
              key={item.member.tag}
              className="bg-brand-surfaceRaised border border-gray-600 rounded-lg p-4 opacity-60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-300">{item.member.name}</h3>
                  <p className="text-sm text-gray-500">
                    Snoozed until {item.snoozedUntil ? new Date(item.snoozedUntil).toLocaleDateString() : 'unknown'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnsnooze(item.member.tag)}
                  className="min-h-[44px]"
                >
                  Unsnooze
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};

export default WatchlistManager;
