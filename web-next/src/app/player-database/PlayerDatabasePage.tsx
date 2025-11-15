"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, RefreshCw, User, Calendar, MessageSquare, X, Users, UserCheck, UserX, AlertTriangle } from "lucide-react";
import dynamic from 'next/dynamic';
import { useShallow } from 'zustand/react/shallow';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';
import { normalizeTag } from '@/lib/tags';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GlassCard } from '@/components/ui/GlassCard';
import LeadershipGuard from '@/components/LeadershipGuard';
import type { Roster } from '@/types';

// Lazy load components to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

const PLAYER_DB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

interface PlayerNote {
  id?: string;
  timestamp: string;
  note: string;
  customFields: Record<string, string>;
  createdBy?: string;
}

interface PlayerWarning {
  timestamp: string;
  warningNote: string;
  isActive: boolean;
}

interface TenureAction {
  timestamp: string;
  action: 'granted' | 'revoked';
  reason?: string;
  grantedBy?: string;
}

interface DepartureAction {
  timestamp: string;
  reason: string;
  recordedBy?: string;
  type: 'voluntary' | 'kicked: inactive' | 'kicked: other';
}

interface TimelineEvent {
  id: string;
  type: 'join' | 'leave' | 'note' | 'warning' | 'tenure' | 'departure' | 'admin_action';
  timestamp: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  details?: Record<string, any>;
}

interface PlayerRecord {
  tag: string;
  name: string;
  notes: PlayerNote[];
  warning?: PlayerWarning;
  tenureActions?: TenureAction[];
  departureActions?: DepartureAction[];
  lastUpdated: string;
  isCurrentMember?: boolean;
  linkedAccounts?: Array<{ tag: string; name: string; membershipStatus?: 'current' | 'former' | 'never' }>;
}

export default function PlayerDatabasePage() {
  const roster = useDashboardStore(useShallow((state) => state.roster)) as Roster | null;
  const clanNameFromSelector = useDashboardStore(selectors.clanName);
  const clanName = roster?.clanName ?? roster?.meta?.clanName ?? clanNameFromSelector;
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || '#2PR8R8V8P');
  const loadRoster = useDashboardStore((state) => state.loadRoster);
  
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showMarkReturnedModal, setShowMarkReturnedModal] = useState(false);
  const [returnNoteText, setReturnNoteText] = useState('');
  const [returnTenureAward, setReturnTenureAward] = useState('');
  const [markingReturned, setMarkingReturned] = useState(false);
  const [departureTenure, setDepartureTenure] = useState<number | null>(null);
  const [editingNote, setEditingNote] = useState<PlayerNote | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newPlayerTag, setNewPlayerTag] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [warningNoteText, setWarningNoteText] = useState('');
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editEventData, setEditEventData] = useState<{
    type: string;
    description: string;
    details: Record<string, any>;
  }>({ type: '', description: '', details: {} });
  const [sortBy, setSortBy] = useState<'name' | 'lastUpdated' | 'noteCount' | 'status'>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'former'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);

  // Get cache key based on clanTag and showArchived flag
  const getCacheKey = useCallback((archived: boolean, currentClanTag: string) => {
    const normalizedClanTag = normalizeTag(currentClanTag) || 'default';
    return `playerDatabase:cache:v1:${normalizedClanTag}:${archived ? 'archived' : 'active'}`;
  }, []);

  // Load cached data from localStorage
  const loadCachedData = useCallback((): PlayerRecord[] | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cacheKey = getCacheKey(showArchived, clanTag);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      if (!parsed.data || !parsed.timestamp) return null;
      
      const age = Date.now() - parsed.timestamp;
      if (age > PLAYER_DB_CACHE_TTL_MS) {
        // Cache expired, remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      setCacheTimestamp(new Date(parsed.timestamp).toISOString());
      return parsed.data as PlayerRecord[];
    } catch (error) {
      console.error('Failed to load cached player database:', error);
      return null;
    }
  }, [showArchived, getCacheKey, clanTag]);

  // Save data to cache
  const saveToCache = useCallback((data: PlayerRecord[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheKey = getCacheKey(showArchived, clanTag);
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      setCacheTimestamp(new Date().toISOString());
    } catch (error) {
      console.error('Failed to save player database cache:', error);
    }
  }, [showArchived, getCacheKey, clanTag]);

  // Handle column sorting
  const handleSort = (field: 'name' | 'lastUpdated' | 'noteCount' | 'status') => {
    if (sortBy === field) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to ascending
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Function to fetch current clan members - use roster from store if available
  const fetchCurrentMembers = useCallback(async () => {
    // Try to use roster from store first (faster, already loaded)
    if (roster?.members && Array.isArray(roster.members) && roster.members.length > 0) {
      return roster.members.map((member: any) => ({
        tag: normalizeTag(member.tag) || member.tag,
        name: member.name || member.tag || 'Unknown Player',
      }));
    }
    
    // Fallback to API if store doesn't have roster
    try {
      const response = await fetch('/api/v2/roster');
      if (response.ok) {
        const data = await response.json();
        const members = Array.isArray(data.data?.members) ? data.data.members : [];
        return members.map((member: any) => ({
          tag: normalizeTag(member.tag) || member.tag,
          name: member.name || member.tag || 'Unknown Player',
        }));
      }
    } catch (error) {
      console.error('Failed to fetch current members:', error);
    }
    return [];
  }, [roster]);

  // Optimized function to load player database using the new unified endpoint
  const loadPlayerDatabase = useCallback(async (forceRefresh = false) => {
    if (typeof window === 'undefined') return;

    // Try to load from cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = loadCachedData();
      if (cachedData && cachedData.length > 0) {
        console.log('[PlayerDatabase] Loading from cache');
        setPlayers(cachedData);
        setLoading(false);
        // Continue fetching fresh data in background
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    try {
      // Use clanTag from store (already normalized)
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      // Add cache-busting parameter when forcing refresh
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
      const url = `/api/player-database?clanTag=${encodeURIComponent(normalizedClanTag)}&includeArchived=${showArchived}${cacheBuster}`;
      
      console.log('[PlayerDatabase] Fetching from optimized endpoint', forceRefresh ? '(force refresh)' : '');
      const startTime = Date.now();
      
      const response = await fetch(url, {
        cache: 'no-store', // Ensure no caching
        credentials: 'same-origin',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      // Handle auth errors (401/403) - they return JSON in the body
      if (!response.ok) {
        let errorMessage = `API returned ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If JSON parsing fails, try text
          const text = await response.text().catch(() => '');
          if (text) errorMessage = text;
        }
        
        // Provide more helpful error messages
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please sign in to access the player database.';
        } else if (response.status === 403) {
          errorMessage = 'Access denied. Leadership role required to view the player database.';
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load player database');
      }
      
      console.log(`[PlayerDatabase] Loaded ${result.data.length} players in ${duration}ms`);
      
      setPlayers(result.data);
      
      // Save to cache
      saveToCache(result.data);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load player database:', error);
      setErrorMessage('Failed to load player database. Please try again.');
      setLoading(false);
    }
  }, [loadCachedData, saveToCache, showArchived, clanTag]); // Reload when clan changes

  // Load roster if not already loaded (for clan name in header)
  useEffect(() => {
    if (!roster && clanTag) {
      void loadRoster(clanTag);
    }
  }, [roster, clanTag, loadRoster]);

  useEffect(() => {
    loadPlayerDatabase();
  }, [loadPlayerDatabase]);

  // Ensure body scroll is enabled on mount and cleanup on unmount
  useEffect(() => {
    // Reset body overflow on mount in case it was left in a bad state
    document.body.style.overflow = 'unset';
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Ensure body overflow is reset whenever the component updates
  useEffect(() => {
    document.body.style.overflow = 'unset';
  });

  // Filter and sort players
  const filteredAndSortedPlayers = players
    .filter(player => {
      // Search filter
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.notes.some(note => 
          note.note.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        (player.warning && player.warning.warningNote.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'current' && player.isCurrentMember) ||
        (statusFilter === 'former' && !player.isCurrentMember);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastUpdated':
          comparison = a.lastUpdated.localeCompare(b.lastUpdated);
          break;
        case 'noteCount':
          comparison = a.notes.length - b.notes.length;
          break;
        case 'status':
          // Sort by status: Current members first, then Former members
          if (a.isCurrentMember && !b.isCurrentMember) {
            comparison = -1; // Current comes before Former
          } else if (!a.isCurrentMember && b.isCurrentMember) {
            comparison = 1; // Former comes after Current
          } else {
            comparison = 0; // Same status, maintain original order
          }
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const openPlayerModal = (player: PlayerRecord) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closePlayerModal = () => {
    setSelectedPlayer(null);
    setShowPlayerModal(false);
    // Restore body scroll when modal is closed
    document.body.style.overflow = 'unset';
  };

  // Event editing functions
  const openEditEventModal = (event: TimelineEvent) => {
    setEditingEvent(event);
    setEditEventData({
      type: event.type,
      description: event.description,
      details: event.details || {}
    });
    setShowEditEventModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeEditEventModal = () => {
    setEditingEvent(null);
    setEditEventData({ type: '', description: '', details: {} });
    setShowEditEventModal(false);
    document.body.style.overflow = 'unset';
  };

  const updateTimelineEvent = async () => {
    if (!editingEvent || !selectedPlayer) {
      console.log('Missing editingEvent or selectedPlayer:', { editingEvent, selectedPlayer });
      return;
    }

    console.log('Updating timeline event:', { editingEvent, editEventData });

    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      
      // For now, let's just update the local data since the API might not support PUT
      // This is a temporary solution until we can implement proper API updates
      
      // Update the local player data
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.tag === selectedPlayer.tag) {
            // Update the specific event in the player's data
            if (editingEvent.type === 'note') {
              const updatedNotes = player.notes.map(note => {
                if (note.timestamp === editingEvent.timestamp) {
                  return {
                    ...note,
                    note: editEventData.description,
                    createdBy: editEventData.details.createdBy || note.createdBy
                  };
                }
                return note;
              });
              return { ...player, notes: updatedNotes };
            } else if (editingEvent.type === 'departure') {
              const updatedDepartures = player.departureActions?.map(departure => {
                if (departure.timestamp === editingEvent.timestamp) {
                  return {
                    ...departure,
                    type: editEventData.details.type || departure.type,
                    reason: editEventData.description,
                    recordedBy: editEventData.details.recordedBy || departure.recordedBy
                  };
                }
                return departure;
              });
              return { ...player, departureActions: updatedDepartures };
            } else if (editingEvent.type === 'tenure') {
              const updatedTenure = player.tenureActions?.map(tenure => {
                if (tenure.timestamp === editingEvent.timestamp) {
                  return {
                    ...tenure,
                    action: editEventData.details.action || tenure.action,
                    reason: editEventData.description,
                    grantedBy: editEventData.details.grantedBy || tenure.grantedBy
                  };
                }
                return tenure;
              });
              return { ...player, tenureActions: updatedTenure };
            }
          }
          return player;
        });
      });

      // Close the modal and show success
      closeEditEventModal();
      setErrorMessage(null);
      
      // Force refresh the selected player data to update the modal
      setTimeout(() => {
        setPlayers(currentPlayers => {
          const updatedPlayer = currentPlayers.find(p => p.tag === selectedPlayer.tag);
          if (updatedPlayer) {
            setSelectedPlayer(updatedPlayer);
          }
          return currentPlayers;
        });
      }, 100);
      
      console.log('Successfully updated timeline event locally');
      
    } catch (error) {
      console.error('Error updating timeline event:', error);
      setErrorMessage(`Failed to update ${editingEvent.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteTimelineEvent = async () => {
    if (!editingEvent || !selectedPlayer) {
      console.log('Missing editingEvent or selectedPlayer for delete:', { editingEvent, selectedPlayer });
      return;
    }

    // Show confirmation dialog
    const eventTypeName = editingEvent.type === 'note' ? 'note' : 
                         editingEvent.type === 'departure' ? 'departure record' :
                         editingEvent.type === 'tenure' ? 'tenure record' :
                         editingEvent.type === 'warning' ? 'warning' : 'event';
    
    const confirmed = window.confirm(`Are you sure you want to archive this ${eventTypeName}? It will be hidden but can be restored later.`);
    
    if (!confirmed) {
      return; // User cancelled the archiving
    }

    console.log('Deleting timeline event:', { editingEvent });

    try {
      // Update the local player data to remove the event
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          if (player.tag === selectedPlayer.tag) {
            // Remove the specific event from the player's data
            if (editingEvent.type === 'note') {
              const updatedNotes = player.notes.filter(note => 
                note.timestamp !== editingEvent.timestamp
              );
              return { ...player, notes: updatedNotes };
            } else if (editingEvent.type === 'departure') {
              const updatedDepartures = player.departureActions?.filter(departure => 
                departure.timestamp !== editingEvent.timestamp
              );
              return { ...player, departureActions: updatedDepartures };
            } else if (editingEvent.type === 'tenure') {
              const updatedTenure = player.tenureActions?.filter(tenure => 
                tenure.timestamp !== editingEvent.timestamp
              );
              return { ...player, tenureActions: updatedTenure };
            }
          }
          return player;
        });
      });

      // Close the modal and show success
      closeEditEventModal();
      setErrorMessage(null);
      
      // Force refresh the selected player data to update the modal
      setTimeout(() => {
        setPlayers(currentPlayers => {
          const updatedPlayer = currentPlayers.find(p => p.tag === selectedPlayer.tag);
          if (updatedPlayer) {
            setSelectedPlayer(updatedPlayer);
          }
          return currentPlayers;
        });
      }, 100);
      
      console.log('Successfully deleted timeline event locally');
      
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      setErrorMessage(`Failed to delete ${editingEvent.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Invalidate cache helper
  const invalidateCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Invalidate cache for current clan (both archived and active)
    try {
      const activeKey = getCacheKey(false, clanTag);
      const archivedKey = getCacheKey(true, clanTag);
      localStorage.removeItem(activeKey);
      localStorage.removeItem(archivedKey);
      setCacheTimestamp(null);
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }, [getCacheKey, clanTag]);

  const handleRefresh = () => {
    invalidateCache();
    loadPlayerDatabase(true); // Force refresh
  };

  // Note management functions
  const addNote = useCallback(async (playerTag: string, noteText: string) => {
    if (!noteText.trim()) return;

    try {
      const normalizedTag = normalizeTag(playerTag);
      if (!normalizedTag) {
        setErrorMessage('Player tag is invalid. Please include a # and only use valid characters.');
        return;
      }
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        setErrorMessage('No clan tag available');
        return;
      }
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag: normalizedTag,
          playerName,
          note: noteText.trim(),
          customFields: {},
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true); // Force refresh after mutation
        setNewNoteText('');
        setShowAddNoteModal(false);
        setErrorMessage(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to add note:', errorText);
        setErrorMessage(`Failed to add note: ${errorText}`);
      }
    } catch (error) {
      console.error('Error adding note:', error);
      setErrorMessage(`Error adding note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedPlayer, loadPlayerDatabase, clanTag, invalidateCache]);

  const editNote = useCallback(async (playerTag: string, noteIndex: number, newText: string) => {
    if (!newText.trim()) return;

    try {
      const player = players.find(p => p.tag === playerTag);
      if (!player || !player.notes[noteIndex]) return;

      const note = player.notes[noteIndex];
      const noteId = (note as any).id; // Assuming we have the ID from Supabase

      const response = await fetch('/api/player-notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: noteId,
          note: newText.trim(),
          customFields: note.customFields || {}
        }),
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
        setEditingNote(null);
        setNewNoteText('');
      } else {
        console.error('Failed to edit note:', await response.text());
      }
    } catch (error) {
      console.error('Error editing note:', error);
    }
  }, [players, loadPlayerDatabase, invalidateCache]);

  const deleteNote = useCallback(async (playerTag: string, noteIndex: number) => {
    try {
      const player = players.find(p => p.tag === playerTag);
      if (!player || !player.notes[noteIndex]) return;

      const note = player.notes[noteIndex];
      const noteId = (note as any).id; // Assuming we have the ID from Supabase

      const response = await fetch(`/api/player-notes?id=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
      } else {
        console.error('Failed to delete note:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }, [players, loadPlayerDatabase, invalidateCache]);

  const openAddNoteModal = useCallback(() => {
    setNewNoteText('');
    setShowAddNoteModal(true);
  }, []);

  const openEditNoteModal = useCallback((note: PlayerNote) => {
    setEditingNote(note);
    setNewNoteText(note.note);
    setShowAddNoteModal(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    setShowAddNoteModal(false);
    setEditingNote(null);
    setNewNoteText('');
  }, []);

  const addNewPlayer = useCallback(async (playerTag: string, playerName: string, noteText: string) => {
    if (!playerTag.trim() || !playerName.trim() || !noteText.trim()) return;

    try {
      const normalizedTag = normalizeTag(playerTag);
      if (!normalizedTag) {
        setErrorMessage('Player tag is invalid. Please include a # and only use valid characters.');
        return;
      }
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizeTag(clanTag) || clanTag,
          playerTag: normalizedTag,
          playerName: playerName.trim(),
          note: noteText.trim(),
          customFields: {},
          createdBy: 'Player Database'
        })
      });

      const result = await response.json();
      if (result.success) {
        invalidateCache();
        loadPlayerDatabase(true);
        setNewPlayerTag('');
        setNewPlayerName('');
        setNewNoteText('');
        setShowAddPlayerModal(false);
      } else {
        console.error('Failed to add player:', result.error);
      }
    } catch (error) {
      console.error('Error adding player:', error);
    }
  }, [loadPlayerDatabase, clanTag, invalidateCache]);

  const openAddPlayerModal = useCallback(() => {
    setNewPlayerTag('');
    setNewPlayerName('');
    setNewNoteText('');
    setShowAddPlayerModal(true);
  }, []);

  const closeAddPlayerModal = useCallback(() => {
    setShowAddPlayerModal(false);
    setNewPlayerTag('');
    setNewPlayerName('');
    setNewNoteText('');
  }, []);

  // Warning management functions
  const setPlayerWarning = useCallback(async (playerTag: string, warningNote: string) => {
    if (!warningNote.trim()) return;

    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-warnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag,
          playerName,
          warningNote: warningNote.trim(),
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
        setWarningNoteText('');
        setShowWarningModal(false);
        setErrorMessage(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to set warning:', errorText);
        setErrorMessage(`Failed to set warning: ${errorText}`);
      }
    } catch (error) {
      console.error('Error setting warning:', error);
      setErrorMessage(`Error setting warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedPlayer, loadPlayerDatabase, clanTag, invalidateCache]);

  const removePlayerWarning = useCallback(async (playerTag: string) => {
    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      
      const response = await fetch(`/api/player-warnings?clanTag=${encodeURIComponent(normalizedClanTag)}&playerTag=${encodeURIComponent(playerTag)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
      } else {
        console.error('Failed to remove warning:', await response.text());
      }
    } catch (error) {
      console.error('Error removing warning:', error);
    }
  }, [loadPlayerDatabase, clanTag, invalidateCache]);

  const openWarningModal = useCallback(() => {
    setWarningNoteText('');
    setShowWarningModal(true);
  }, []);

  const closeWarningModal = useCallback(() => {
    setShowWarningModal(false);
    setWarningNoteText('');
  }, []);

  // Tenure management functions
  const addTenureAction = useCallback(async (playerTag: string, action: 'granted' | 'revoked', reason?: string, grantedBy?: string) => {
    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag,
          playerName,
          actionType: 'tenure',
          actionData: {
            action,
            reason,
            grantedBy
          },
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
      } else {
        console.error('Failed to add tenure action:', await response.text());
      }
    } catch (error) {
      console.error('Error adding tenure action:', error);
    }
  }, [selectedPlayer, loadPlayerDatabase, clanTag, invalidateCache]);

  // Departure management functions
  const addDepartureAction = useCallback(async (playerTag: string, reason: string, type: 'voluntary' | 'kicked: inactive' | 'kicked: other', recordedBy?: string) => {
    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag,
          playerName,
          actionType: 'departure',
          actionData: {
            reason,
            departureType: type,
            recordedBy
          },
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        invalidateCache();
        loadPlayerDatabase(true);
      } else {
        console.error('Failed to add departure action:', await response.text());
      }
    } catch (error) {
      console.error('Error adding departure action:', error);
    }
  }, [selectedPlayer, loadPlayerDatabase, clanTag, invalidateCache]);

  // Mark player as returned
  const handleMarkReturned = useCallback(async () => {
    if (!selectedPlayer) return;

    setMarkingReturned(true);
    try {
      const normalizedClanTag = normalizeTag(clanTag);
      if (!normalizedClanTag) {
        throw new Error('No clan tag available');
      }

      const response = await fetch('/api/player-history/mark-returned', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
          playerTag: selectedPlayer.tag,
          playerName: selectedPlayer.name,
          note: returnNoteText.trim() || undefined,
          awardPreviousTenure: returnTenureAward ? parseInt(returnTenureAward, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to mark player as returned (${response.status})`);
      }

      // Close modal and reset state
      setShowMarkReturnedModal(false);
      setReturnNoteText('');
      setReturnTenureAward('');
      
      // Refresh player database and roster
      invalidateCache();
      loadPlayerDatabase(true);
      await loadRoster(normalizedClanTag, { mode: 'snapshot', force: true });
      
      // Close player modal and show success
      setShowPlayerModal(false);
      setSelectedPlayer(null);
      
      alert('Player marked as returned! They should now appear in the roster.');
    } catch (error: any) {
      console.error('Error marking player as returned:', error);
      setErrorMessage(error.message || 'Failed to mark player as returned');
    } finally {
      setMarkingReturned(false);
    }
  }, [selectedPlayer, clanTag, returnNoteText, returnTenureAward, invalidateCache, loadPlayerDatabase, loadRoster]);

  // Generate timeline from player data
  const generatePlayerTimeline = useCallback((player: PlayerRecord): TimelineEvent[] => {
    const events: TimelineEvent[] = [];


    // Add notes
    player.notes.forEach((note, index) => {
      events.push({
        id: `note-${index}`,
        type: 'note',
        timestamp: note.timestamp,
        title: 'Note Added',
        description: note.note,
        icon: '📝',
        color: 'blue',
        details: { createdBy: note.createdBy }
      });
    });

    // Add warning if active
    if (player.warning?.isActive) {
      events.push({
        id: 'warning',
        type: 'warning',
        timestamp: player.warning.timestamp,
        title: 'Warning Set',
        description: player.warning.warningNote,
        icon: '⚠️',
        color: 'red'
      });
    }

    // Add tenure actions
    if (player.tenureActions) {
      player.tenureActions.forEach((tenure, index) => {
        events.push({
          id: `tenure-${index}`,
          type: 'tenure',
          timestamp: tenure.timestamp,
          title: `Tenure ${tenure.action === 'granted' ? 'Granted' : 'Revoked'}`,
          description: tenure.reason || `Tenure ${tenure.action} by ${tenure.grantedBy || 'leader'}`,
          icon: tenure.action === 'granted' ? '🕐' : '❌',
          color: tenure.action === 'granted' ? 'green' : 'red',
          details: { action: tenure.action, grantedBy: tenure.grantedBy }
        });
      });
    }

    // Add departure actions
    if (player.departureActions) {
      player.departureActions.forEach((departure, index) => {
        // Determine if this was a kick or voluntary departure based on reason
        const isKick = departure.reason.toLowerCase().includes('kicked');
        const isVoluntary = departure.reason.toLowerCase().includes('voluntarily') || 
                           departure.reason.toLowerCase().includes('left voluntarily');
        
        const typeEmoji = {
          'voluntary': '👋',
          'kicked: inactive': '👢',
          'kicked: other': '👢'
        };
        
        // Create a more descriptive title
        let title = 'Departure Recorded';
        if (isKick) {
          title = 'Player Kicked';
        } else if (isVoluntary) {
          title = 'Player Left Voluntarily';
        } else {
          title = `Departure Recorded (${departure.type})`;
        }
        
        // Use the departure timestamp, or fall back to a reasonable date
        const departureTimestamp = departure.timestamp || new Date().toISOString();
        
        events.push({
          id: `departure-${index}`,
          type: 'departure',
          timestamp: departureTimestamp,
          title: title,
          description: departure.reason,
          icon: isKick ? '👢' : isVoluntary ? '👋' : (typeEmoji[departure.type] || '👋'),
          color: isKick ? 'red' : isVoluntary ? 'blue' : (departure.type === 'voluntary' ? 'blue' : departure.type.startsWith('kicked:') ? 'red' : 'orange'),
          details: { type: departure.type, recordedBy: departure.recordedBy, isKick, isVoluntary }
        });
      });
    }

    // Add join/leave events based on current status
    if (player.isCurrentMember) {
      // If currently a member, add a "joined" event (using oldest note date or current date)
      const oldestNote = player.notes.reduce((oldest, note) => 
        note.timestamp < oldest ? note.timestamp : oldest, 
        player.notes[0]?.timestamp || new Date().toISOString()
      );
      
      events.push({
        id: 'current-join',
        type: 'join',
        timestamp: oldestNote,
        title: 'Joined Clan',
        description: 'Currently an active member',
        icon: '✅',
        color: 'green'
      });
    } else {
      // If former member, only add a "left" event if there are no specific departure records
      const hasSpecificDeparture = player.departureActions && player.departureActions.length > 0;
      
      if (!hasSpecificDeparture) {
        // Only create a generic "Left Clan" event if no specific departure records exist
        // Use the most recent note date, but only if it's reasonable (not today)
        const mostRecentNote = player.notes.reduce((newest, note) => 
          note.timestamp > newest ? note.timestamp : newest, 
          player.notes[0]?.timestamp || new Date().toISOString()
        );
        
        // Only add if the most recent note is not from today (to avoid false "left today" events)
        const noteDate = new Date(mostRecentNote);
        const today = new Date();
        const isFromToday = noteDate.toDateString() === today.toDateString();
        
        if (!isFromToday) {
          events.push({
            id: 'former-leave',
            type: 'leave',
            timestamp: mostRecentNote,
            title: 'Left Clan',
            description: 'No longer an active member',
            icon: '🚪',
            color: 'orange'
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  if (loading) {
    return (
      <DashboardLayout clanName={clanName && clanName.trim().length > 0 ? clanName : undefined}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
            <span className="text-brand-text-secondary">Loading player database...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout clanName={clanName && clanName.trim().length > 0 ? clanName : undefined}>
      <div className="space-y-6">
        {/* Header */}
        <GlassCard 
          title="Player Database"
          subtitle="View notes and history for all clan members (current and former)"
          actions={
            <div className="flex items-center space-x-3">
              {cacheTimestamp && (
                <div className="text-xs text-brand-text-secondary/70">
                  Cached: {safeLocaleString(new Date(cacheTimestamp))}
                </div>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center space-x-2"
                title="Refresh data from server (clears cache)"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </Button>
              <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openAddPlayerModal}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Player</span>
                </Button>
              </LeadershipGuard>
            </div>
          }
        />

        {/* Error Message */}
        {errorMessage && (
          <GlassCard className="border-red-200 bg-red-50/10">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="stat-tile">
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50">
                <Users className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-muted">Total Players</p>
                <p className="text-xl font-semibold text-high-contrast">{players.length}</p>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="stat-tile">
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-900/30 border border-emerald-700/30">
                <UserCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted">Current Members</p>
                <p className="text-xl font-semibold text-high-contrast">
                  {players.filter(p => p.isCurrentMember).length}
                </p>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="stat-tile">
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-900/30 border border-orange-700/30">
                <UserX className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted">Former Members</p>
                <p className="text-xl font-semibold text-high-contrast">
                  {players.filter(p => !p.isCurrentMember).length}
                </p>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="stat-tile">
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-900/30 border border-red-700/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted">Players with Warnings</p>
                <p className="text-xl font-semibold text-high-contrast">
                  {players.filter(p => p.warning?.isActive).length}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Filters and Search */}
        <GlassCard>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search players, tags, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'current' | 'former')}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-sm text-white dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 dark:placeholder:text-gray-300"
                >
                  <option value="all" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">All Players</option>
                  <option value="current" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">Current Members</option>
                  <option value="former" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">Former Members</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'lastUpdated' | 'noteCount')}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-sm text-white dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 dark:placeholder:text-gray-300"
                >
                  <option value="lastUpdated" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">Last Updated</option>
                  <option value="name" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">Name</option>
                  <option value="noteCount" className="text-gray-900 dark:text-white bg-white dark:bg-gray-800">Note Count</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={showArchived ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-sm"
                >
                  {showArchived ? 'Hide Archived' : 'Show Archived'}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Players Table */}
        <GlassCard>
          {filteredAndSortedPlayers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-high-contrast mb-2">
                {searchTerm ? 'No players found' : 'No players in database'}
              </h3>
              <p className="text-muted">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'No players with notes found. Add notes to track player history and status.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-high-contrast transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Player</span>
                        {sortBy === 'name' && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-high-contrast transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortBy === 'status' && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">
                      Warning
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-high-contrast transition-colors"
                      onClick={() => handleSort('noteCount')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Notes</span>
                        {sortBy === 'noteCount' && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer hover:text-high-contrast transition-colors"
                      onClick={() => handleSort('lastUpdated')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Last Updated</span>
                        {sortBy === 'lastUpdated' && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredAndSortedPlayers.map((player) => (
                    <tr 
                      key={player.tag}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => openPlayerModal(player)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-high-contrast">
                              {player.name}
                            </div>
                            {player.linkedAccounts && player.linkedAccounts.length > 0 && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                title={(() => {
                                  const accounts = player.linkedAccounts!.map(a => {
                                    const status = a.membershipStatus === 'current' ? ' (Current)' : 
                                                   a.membershipStatus === 'former' ? ' (Former)' : '';
                                    return `${a.name || a.tag}${status}`;
                                  }).join(', ');
                                  return `Linked to ${player.linkedAccounts!.length} account(s): ${accounts}`;
                                })()}
                              >
                                🔗 {player.linkedAccounts.length}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted opacity-75">
                            {player.tag}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {player.isCurrentMember ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Current
                          </span>
                        ) : (
                          <span className="text-sm text-muted">
                            Former
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {player.warning?.isActive ? (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ⚠️ Warning
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="w-4 h-4 text-muted" />
                          <span className="text-sm text-high-contrast">
                            {player.notes.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted" />
                          <span className="text-sm text-high-contrast">
                            {safeLocaleDateString(new Date(player.lastUpdated))}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openPlayerModal(player);
              }}
              className="text-sm text-white dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View Details
            </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Player Modal */}
        <Modal
          isOpen={showPlayerModal}
          onClose={closePlayerModal}
          title={selectedPlayer?.name}
          size="full"
          closeOnOverlayClick={false}
        >
          {selectedPlayer && (
            <div className="space-y-4">
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">Player Tag</p>
                  <p className="text-slate-100 font-mono">{selectedPlayer.tag}</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    selectedPlayer.isCurrentMember 
                      ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' 
                      : 'bg-orange-900/40 text-orange-300 border border-orange-700/40'
                  }`}>
                    {selectedPlayer.isCurrentMember ? 'Current Member' : 'Former Member'}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Warn on Return</p>
                  <LeadershipGuard requiredPermission="canModifyClanData" fallback={
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-200">
                        {selectedPlayer.warning?.isActive ? 'Warning Active' : 'No Warning Set'}
                      </span>
                    </div>
                  }>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPlayer.warning?.isActive || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              openWarningModal();
                            } else {
                              removePlayerWarning(selectedPlayer.tag);
                            }
                          }}
                          className="w-4 h-4 text-blue-500 bg-slate-800/50 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-slate-200">
                          {selectedPlayer.warning?.isActive ? 'Warning Active' : 'No Warning Set'}
                        </span>
                      </label>
                      {selectedPlayer.warning?.isActive && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removePlayerWarning(selectedPlayer.tag)}
                          className="text-xs"
                        >
                          Remove Warning
                        </Button>
                      )}
                    </div>
                  </LeadershipGuard>
                  {selectedPlayer.warning?.isActive && (
                    <div className="mt-2 p-3 bg-red-900/30 border border-red-700/40 rounded-lg">
                      <p className="text-sm text-red-300 font-medium mb-1">Warning Note:</p>
                      <p className="text-sm text-red-200 break-words overflow-wrap-anywhere">{selectedPlayer.warning.warningNote}</p>
                      <p className="text-xs text-red-300/80 mt-1">
                        Set on {safeLocaleString(new Date(selectedPlayer.warning.timestamp))}
                      </p>
                    </div>
                  )}
                </div>

                  
                  {/* Quick Actions for Leaders */}
                  <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                    <div className="mb-4 p-3 bg-slate-800/30 border border-slate-700/40 rounded-lg">
                      <p className="text-xs text-slate-400 mb-3">Quick Actions</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const action = prompt('Edit Tenure:\n\n1. Grant tenure\n2. Revoke tenure\n\nEnter 1 or 2:');
                            if (!action || (action !== '1' && action !== '2')) return;
                            const reason = prompt(`Reason for ${action === '1' ? 'granting' : 'revoking'} tenure:`);
                            if (!reason) return;
                            addTenureAction(
                              selectedPlayer.tag,
                              action === '1' ? 'granted' : 'revoked',
                              reason,
                              'Current Leader'
                            );
                          }}
                          className="flex items-center justify-center space-x-1 text-xs"
                        >
                          <span>🛠️</span>
                          <span>Edit Tenure</span>
                        </Button>
                        <Button
                            variant="warning"
                            size="sm"
                            onClick={() => {
                              // Show a more detailed departure recording dialog
                              const departureType = prompt(
                                'How did this player leave?\n\n' +
                                '1. Left voluntarily\n' +
                                '2. Kicked for inactivity\n' +
                                '3. Kicked for behavior\n' +
                                '4. Kicked for war performance\n' +
                                '5. Kicked for other reasons\n\n' +
                                'Enter number (1-5):'
                              );
                              
                              if (!departureType || !['1', '2', '3', '4', '5'].includes(departureType)) {
                                return;
                              }
                              
                              const reasonMap: Record<string, string> = {
                                '1': 'Left voluntarily',
                                '2': 'Kicked for inactivity', 
                                '3': 'Kicked for behavior',
                                '4': 'Kicked for war performance',
                                '5': 'Kicked for other reasons'
                              };
                              
                              const additionalNotes = prompt('Additional notes (optional):');
                              const fullReason = additionalNotes ? 
                                `${reasonMap[departureType]} - ${additionalNotes}` : 
                                reasonMap[departureType];
                              
                              const type = departureType === '1' ? 'voluntary' : 'kicked: other';
                              
                              addDepartureAction(selectedPlayer.tag, fullReason, type as any, 'Current Leader');
                            }}
                          className="flex items-center justify-center space-x-1 text-xs"
                          >
                          <span>👋</span>
                          <span>Record Departure</span>
                          </Button>
                        {!selectedPlayer.isCurrentMember && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                              setReturnNoteText('');
                              setReturnTenureAward('');
                              setDepartureTenure(null);
                              
                              // Try to get departure tenure from multiple sources
                              try {
                                const normalizedClanTag = normalizeTag(clanTag);
                                if (normalizedClanTag && selectedPlayer.tag) {
                                  let foundTenure: number | null = null;
                                  
                                  console.log('[MarkReturned] Checking departure tenure for:', selectedPlayer.tag);
                                  console.log('[MarkReturned] Player record:', {
                                    departureActions: selectedPlayer.departureActions,
                                    notes: selectedPlayer.notes?.length,
                                    notesData: selectedPlayer.notes,
                                  });
                                  
                                  // First, check notes for "Tenure at Departure" in customFields (most reliable)
                                  if (selectedPlayer.notes && selectedPlayer.notes.length > 0) {
                                    console.log('[MarkReturned] Checking notes for tenure...');
                                    // Look for departure notes (check in reverse order for most recent)
                                    for (let i = selectedPlayer.notes.length - 1; i >= 0; i--) {
                                      const note = selectedPlayer.notes[i];
                                      console.log('[MarkReturned] Note:', i, 'customFields:', JSON.stringify(note.customFields, null, 2));
                                      if (note.customFields) {
                                        // Check various possible field names
                                        const tenureStr = note.customFields['Tenure at Departure'] || 
                                                         note.customFields['Tenure at departure'] ||
                                                         note.customFields['tenureAtDeparture'] ||
                                                         note.customFields['Tenure At Departure'];
                                        console.log('[MarkReturned] Checking tenureStr:', tenureStr);
                                        if (tenureStr) {
                                          const tenureNum = parseInt(String(tenureStr), 10);
                                          console.log('[MarkReturned] Found tenure in note:', tenureStr, '->', tenureNum);
                                          if (!isNaN(tenureNum) && tenureNum > 0) {
                                            foundTenure = tenureNum;
                                            break;
                                          }
                                        }
                                      }
                                    }
                                  }
                                  
                                  // Check departureActions
                                  if (foundTenure == null && selectedPlayer.departureActions && selectedPlayer.departureActions.length > 0) {
                                    console.log('[MarkReturned] Checking departureActions...', JSON.stringify(selectedPlayer.departureActions, null, 2));
                                    const lastDeparture = selectedPlayer.departureActions[selectedPlayer.departureActions.length - 1];
                                    console.log('[MarkReturned] Last departure:', JSON.stringify(lastDeparture, null, 2));
                                    if ((lastDeparture as any).tenureAtDeparture != null) {
                                      foundTenure = (lastDeparture as any).tenureAtDeparture;
                                    }
                                  }
                                  
                                  // Fallback: fetch from player_history API
                                  if (foundTenure == null) {
                                    console.log('[MarkReturned] Fetching from player_history API...');
                                    const response = await fetch(
                                      `/api/player-history?clanTag=${encodeURIComponent(normalizedClanTag)}&playerTag=${encodeURIComponent(selectedPlayer.tag)}`,
                                      {
                                        credentials: 'same-origin',
                                      }
                                    );
                                    if (response.ok) {
                                      const data = await response.json();
                                      console.log('[MarkReturned] History API response:', JSON.stringify(data, null, 2));
                                      if (data.success && data.data && data.data.length > 0) {
                                        const history = data.data[0];
                                        console.log('[MarkReturned] History data:', JSON.stringify(history, null, 2));
                                        // Check total_tenure from history record
                                        if (history.total_tenure != null && history.total_tenure > 0) {
                                          console.log('[MarkReturned] Found total_tenure in history:', history.total_tenure);
                                          foundTenure = history.total_tenure;
                                        }
                                        // Find the last departure movement
                                        if (foundTenure == null) {
                                          const movements = history.movements || [];
                                          const departures = movements.filter((m: any) => m.type === 'departed');
                                          console.log('[MarkReturned] Departures in history:', JSON.stringify(departures, null, 2));
                                          if (departures.length > 0) {
                                            const lastDeparture = departures[departures.length - 1];
                                            console.log('[MarkReturned] Last departure movement:', JSON.stringify(lastDeparture, null, 2));
                                            if (lastDeparture.tenureAtDeparture != null) {
                                              foundTenure = lastDeparture.tenureAtDeparture;
                                            }
                                          }
                                        }
                                        // Also check notes in history
                                        if (foundTenure == null && history.notes) {
                                          console.log('[MarkReturned] Checking history notes...', JSON.stringify(history.notes, null, 2));
                                          for (let i = history.notes.length - 1; i >= 0; i--) {
                                            const note = history.notes[i];
                                            console.log('[MarkReturned] History note:', i, JSON.stringify(note, null, 2));
                                            if (note.customFields) {
                                              const tenureStr = note.customFields['Tenure at Departure'] || 
                                                               note.customFields['Tenure at departure'] ||
                                                               note.customFields['tenureAtDeparture'] ||
                                                               note.customFields['Tenure At Departure'];
                                              console.log('[MarkReturned] History note tenureStr:', tenureStr);
                                              if (tenureStr) {
                                                const tenureNum = parseInt(String(tenureStr), 10);
                                                if (!isNaN(tenureNum) && tenureNum > 0) {
                                                  foundTenure = tenureNum;
                                                  break;
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                  
                                  // Final fallback: Try to get from player profile (last known tenure)
                                  if (foundTenure == null) {
                                    console.log('[MarkReturned] Trying player profile API for last known tenure...');
                                    try {
                                      const profileResponse = await fetch(
                                        `/api/player/${encodeURIComponent(selectedPlayer.tag)}/profile?clanTag=${encodeURIComponent(normalizedClanTag)}`,
                                        {
                                          credentials: 'same-origin',
                                        }
                                      );
                                      if (profileResponse.ok) {
                                        const profileData = await profileResponse.json();
                                        console.log('[MarkReturned] Profile API response:', JSON.stringify(profileData, null, 2));
                                        if (profileData.success && profileData.data?.summary?.tenureDays != null) {
                                          const profileTenure = profileData.data.summary.tenureDays;
                                          console.log('[MarkReturned] Found tenure in profile:', profileTenure);
                                          if (profileTenure > 0) {
                                            foundTenure = profileTenure;
                                          }
                                        }
                                      }
                                    } catch (profileError) {
                                      console.warn('[MarkReturned] Failed to fetch profile:', profileError);
                                    }
                                  }
                                  
                                  console.log('[MarkReturned] Final foundTenure:', foundTenure);
                                  if (foundTenure != null) {
                                    setDepartureTenure(foundTenure);
                                    setReturnTenureAward(foundTenure.toString());
                                  }
                                }
                              } catch (error) {
                                console.error('[MarkReturned] Failed to fetch departure tenure:', error);
                              }
                              
                              setShowMarkReturnedModal(true);
                            }}
                            className="flex items-center justify-center space-x-1 text-xs"
                          >
                            <span>✅</span>
                            <span>Mark Returned</span>
                          </Button>
                        )}
                        </div>
                      </div>
                    </LeadershipGuard>

                {/* Player Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-300 font-medium">Player History</p>
                    <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openAddNoteModal}
                        className="flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note</span>
                      </Button>
                    </LeadershipGuard>
                  </div>
                  <div className="border border-slate-700/40 rounded-lg bg-slate-800/20">
                    <div className="p-4 max-w-full">
                      {generatePlayerTimeline(selectedPlayer).map((event, index) => (
                        <div key={event.id} className={`relative border-b border-slate-700/30 pb-4 ${index % 2 === 0 ? 'bg-slate-800/10' : ''}`}>
                          <div className="flex items-start space-x-3">
                            <div className="relative flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border ${
                                event.color === 'green' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40' :
                                event.color === 'red' ? 'bg-red-900/40 text-red-300 border-red-700/40' :
                                event.color === 'orange' ? 'bg-orange-900/40 text-orange-300 border-orange-700/40' :
                                'bg-blue-900/40 text-blue-300 border-blue-700/40'
                              }`}>
                                <div className="w-2 h-2 rounded-full bg-current"></div>
                              </div>
                              {index < generatePlayerTimeline(selectedPlayer).length - 1 && (
                                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-slate-700/40"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  <span className="text-lg flex-shrink-0">{event.icon}</span>
                                  <div className="flex flex-col space-y-1 flex-1">
                                    <p className="text-sm font-medium text-slate-200">
                                      {event.title}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {safeLocaleString(new Date(event.timestamp))}
                                    </p>
                                  </div>
                                </div>
                                <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                                  <button
                                    onClick={() => openEditEventModal(event)}
                                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors flex-shrink-0 border border-slate-700/40 hover:border-slate-600/60"
                                    title="Edit this event"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </LeadershipGuard>
                              </div>
                              <p className="text-sm text-slate-300 mt-2 break-words overflow-wrap-anywhere pr-4">
                                {event.description}
                              </p>
                              {event.details && (
                                <div className="mt-1 text-xs text-slate-400 pr-4">
                                  {event.details.grantedBy && (
                                    <span>By: {event.details.grantedBy}</span>
                                  )}
                                  {event.details.recordedBy && (
                                    <span>Recorded by: {event.details.recordedBy}</span>
                                  )}
                                  {event.details.createdBy && (
                                    <span>by {event.details.createdBy}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {generatePlayerTimeline(selectedPlayer).length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-sm text-slate-400">No history available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Add/Edit Note Modal */}
        <Modal
          isOpen={showAddNoteModal}
          onClose={closeNoteModal}
          title={editingNote ? 'Edit Note' : 'Add Note'}
          size="md"
          closeOnOverlayClick={false}
        >
          {selectedPlayer && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Note for {selectedPlayer.name}
                </p>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Enter your note here..."
                  className="w-full h-32 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="ghost"
                  onClick={closeNoteModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (editingNote) {
                      const noteIndex = selectedPlayer.notes.findIndex(n => n.timestamp === editingNote.timestamp);
                      editNote(selectedPlayer.tag, noteIndex, newNoteText);
                    } else {
                      addNote(selectedPlayer.tag, newNoteText);
                    }
                  }}
                  disabled={!newNoteText.trim()}
                >
                  {editingNote ? 'Update Note' : 'Add Note'}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Add Player Modal */}
        <Modal
          isOpen={showAddPlayerModal}
          onClose={closeAddPlayerModal}
          title="Add New Player"
          size="md"
          closeOnOverlayClick={false}
        >
          <div className="space-y-4">
            <div>
              <Input
                label="Player Tag"
                type="text"
                value={newPlayerTag}
                onChange={(e) => setNewPlayerTag(e.target.value)}
                placeholder="e.g., #ABC123DEF"
                autoFocus
              />
            </div>
            
            <div>
              <Input
                label="Player Name"
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="e.g., PlayerName"
              />
            </div>
            
            <div>
              <label className="block text-sm text-muted mb-2">
                Initial Note
              </label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Enter initial note for this player..."
                className="w-full h-24 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-high-contrast placeholder:text-muted"
              />
            </div>
            
            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={closeAddPlayerModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => addNewPlayer(newPlayerTag, newPlayerName, newNoteText)}
                disabled={!newPlayerTag.trim() || !newPlayerName.trim() || !newNoteText.trim()}
              >
                Add Player
              </Button>
            </div>
          </div>
        </Modal>

        {/* Warning Modal */}
        <Modal
          isOpen={showWarningModal}
          onClose={closeWarningModal}
          title="Set Warning for Return"
          size="md"
          closeOnOverlayClick={false}
        >
          {selectedPlayer && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This player will be flagged with a special warning message when they try to return to the clan.
                </p>
              </div>
              
              <div>
                <label className="block text-sm text-muted mb-2">
                  Warning Note for {selectedPlayer.name}
                </label>
                <textarea
                  value={warningNoteText}
                  onChange={(e) => setWarningNoteText(e.target.value)}
                  placeholder="Enter the warning message that will be shown when this player tries to return..."
                  className="w-full h-32 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-high-contrast placeholder:text-muted"
                  autoFocus
                />
                <p className="text-xs text-muted mt-1">
                  This note will be displayed prominently when the player attempts to rejoin.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="ghost"
                  onClick={closeWarningModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setPlayerWarning(selectedPlayer.tag, warningNoteText)}
                  disabled={!warningNoteText.trim()}
                >
                  Set Warning
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Edit Event Modal */}
        <Modal
          isOpen={showEditEventModal}
          onClose={closeEditEventModal}
          title={`Edit ${editingEvent?.type || 'Event'}`}
          size="md"
          closeOnOverlayClick={false}
        >
          {editingEvent && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Editing:</strong> {editingEvent.title} from {safeLocaleString(new Date(editingEvent.timestamp))}
                </p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Event Type
                </label>
                <select
                  value={editEventData.type}
                  onChange={(e) => setEditEventData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                >
                  <option value="note">Note</option>
                  <option value="departure">Departure</option>
                  <option value="tenure">Tenure</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              {editEventData.type === 'departure' && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Departure Type
                  </label>
                  <select
                    value={editEventData.details.type || 'voluntary'}
                    onChange={(e) => setEditEventData(prev => ({ 
                      ...prev, 
                      details: { ...prev.details, type: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  >
                    <option value="voluntary">Voluntary</option>
                    <option value="kicked: inactive">Kicked: Inactive</option>
                    <option value="kicked: other">Kicked: Other</option>
                  </select>
                </div>
              )}

              {editEventData.type === 'tenure' && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Tenure Action
                  </label>
                  <select
                    value={editEventData.details.action || 'granted'}
                    onChange={(e) => setEditEventData(prev => ({ 
                      ...prev, 
                      details: { ...prev.details, action: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  >
                    <option value="granted">Granted</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Description/Reason
                </label>
                <textarea
                  value={editEventData.description}
                  onChange={(e) => setEditEventData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description or reason..."
                  className="w-full h-24 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Recorded By
                </label>
                <input
                  type="text"
                  value={editEventData.details.recordedBy || editEventData.details.createdBy || editEventData.details.by || 'Current Leader'}
                  onChange={(e) => {
                    const field = editEventData.type === 'note' ? 'createdBy' : 
                                 editEventData.type === 'tenure' ? 'by' : 'recordedBy';
                    setEditEventData(prev => ({ 
                      ...prev, 
                      details: { ...prev.details, [field]: e.target.value }
                    }));
                  }}
                  className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  placeholder="Who recorded this event?"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                  <Button
                    variant="ghost"
                    onClick={deleteTimelineEvent}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20"
                  >
                    Archive Event
                  </Button>
                </LeadershipGuard>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    onClick={closeEditEventModal}
                  >
                    Cancel
                  </Button>
                  <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                    <Button
                      variant="primary"
                      onClick={updateTimelineEvent}
                      disabled={!editEventData.description.trim()}
                    >
                      Update Event
                    </Button>
                  </LeadershipGuard>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Mark Returned Modal */}
        <Modal
          isOpen={showMarkReturnedModal}
          onClose={() => {
            setShowMarkReturnedModal(false);
            setReturnNoteText('');
            setReturnTenureAward('');
            setErrorMessage(null);
          }}
          title="Mark Player as Returned"
          size="md"
        >
          {selectedPlayer && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-2">Player</p>
                <p className="text-slate-100 font-medium">{selectedPlayer.name}</p>
                <p className="text-xs text-slate-400 font-mono">{selectedPlayer.tag}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Return Note (Optional)
                </label>
                <textarea
                  value={returnNoteText}
                  onChange={(e) => setReturnNoteText(e.target.value)}
                  placeholder="e.g., Player returned today, ready to participate in wars..."
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-100 placeholder-slate-500"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Award Previous Tenure (Optional)
                </label>
                {departureTenure !== null && (
                  <div className="mb-2 p-2 bg-blue-900/30 border border-blue-700/40 rounded-lg">
                    <p className="text-xs text-blue-300">
                      <strong>Tenure at departure:</strong> {departureTenure} days
                      {returnTenureAward === departureTenure.toString() && (
                        <span className="ml-2 text-green-300">(Pre-filled)</span>
                      )}
                    </p>
                  </div>
                )}
                <input
                  type="number"
                  value={returnTenureAward}
                  onChange={(e) => setReturnTenureAward(e.target.value)}
                  placeholder={departureTenure !== null ? `${departureTenure} days (from departure record)` : "Days of previous tenure to add"}
                  min="0"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-100 placeholder-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {departureTenure !== null 
                    ? `The player had ${departureTenure} days of tenure when they left. This value has been pre-filled, but you can adjust it if needed.`
                    : "Tenure at departure was not recorded. If this player had previous tenure before leaving, enter the number of days to add back. You can leave this blank if they had no previous tenure."
                  }
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-900/30 border border-red-700/40 rounded-lg">
                  <p className="text-sm text-red-300">{errorMessage}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowMarkReturnedModal(false);
                    setReturnNoteText('');
                    setReturnTenureAward('');
                    setErrorMessage(null);
                  }}
                  disabled={markingReturned}
                >
                  Cancel
                </Button>
                <LeadershipGuard requiredPermission="canModifyClanData" fallback={null}>
                  <Button
                    variant="primary"
                    onClick={handleMarkReturned}
                    disabled={markingReturned}
                  >
                    {markingReturned ? 'Marking Returned...' : 'Mark as Returned'}
                  </Button>
                </LeadershipGuard>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
