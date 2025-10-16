"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, RefreshCw, User, Calendar, MessageSquare, X } from "lucide-react";
import dynamic from 'next/dynamic';
import { safeLocaleDateString, safeLocaleString } from '@/lib/date';

// Lazy load components to avoid module-time side effects
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

interface PlayerNote {
  id?: string;
  timestamp: string;
  note: string;
  customFields: Record<string, string>;
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
  type: 'voluntary' | 'involuntary' | 'inactive';
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
}

interface PlayerDatabasePageProps {
  currentClanMembers?: string[];
}

export default function PlayerDatabasePage({ currentClanMembers = [] }: PlayerDatabasePageProps) {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [editingNote, setEditingNote] = useState<PlayerNote | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newPlayerTag, setNewPlayerTag] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [warningNoteText, setWarningNoteText] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'lastUpdated' | 'noteCount'>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentMembers, setCurrentMembers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'current' | 'former'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Function to fetch current clan members
  const fetchCurrentMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/roster');
      if (response.ok) {
        const data = await response.json();
        const memberTags = data.data?.members?.map((member: any) => member.tag) || [];
        setCurrentMembers(memberTags);
        return memberTags;
      }
    } catch (error) {
      console.error('Failed to fetch current members:', error);
    }
    return [];
  }, []);

  // Function to load player data from localStorage (your existing data)
  const loadFromLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return { players: [], notes: [], warnings: [], actions: [], playerNames: {} };
    
    const players: PlayerRecord[] = [];
    const notes: any[] = [];
    const warnings: any[] = [];
    const actions: any[] = [];
    
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Load player notes
    keys.forEach(key => {
      if (key.startsWith('player_notes_')) {
        const playerTag = key.replace('player_notes_', '');
        try {
          const notesData = JSON.parse(localStorage.getItem(key) || '[]');
          notesData.forEach((note: any) => {
            notes.push({
              ...note,
              playerTag,
              source: 'localStorage'
            });
          });
        } catch (e) {
          console.error('Error parsing notes for', playerTag, e);
        }
      }
    });
    
    // Load player names
    const playerNames: Record<string, string> = {};
    keys.forEach(key => {
      if (key.startsWith('player_name_')) {
        const playerTag = key.replace('player_name_', '');
        playerNames[playerTag] = localStorage.getItem(key) || 'Unknown Player';
      }
    });
    
    // Load warnings
    keys.forEach(key => {
      if (key.startsWith('player_warning_')) {
        const playerTag = key.replace('player_warning_', '');
        try {
          const warningData = JSON.parse(localStorage.getItem(key) || '{}');
          if (warningData.timestamp && warningData.warningNote) {
            warnings.push({
              ...warningData,
              playerTag,
              source: 'localStorage'
            });
          }
        } catch (e) {
          console.error('Error parsing warning for', playerTag, e);
        }
      }
    });
    
    // Load tenure actions
    keys.forEach(key => {
      if (key.startsWith('player_tenure_')) {
        const playerTag = key.replace('player_tenure_', '');
        try {
          const tenureData = JSON.parse(localStorage.getItem(key) || '[]');
          tenureData.forEach((action: any) => {
            actions.push({
              ...action,
              playerTag,
              actionType: 'tenure',
              source: 'localStorage'
            });
          });
        } catch (e) {
          console.error('Error parsing tenure for', playerTag, e);
        }
      }
    });
    
    // Load departure actions
    keys.forEach(key => {
      if (key.startsWith('player_departure_')) {
        const playerTag = key.replace('player_departure_', '');
        try {
          const departureData = JSON.parse(localStorage.getItem(key) || '[]');
          departureData.forEach((action: any) => {
            actions.push({
              ...action,
              playerTag,
              actionType: 'departure',
              source: 'localStorage'
            });
          });
        } catch (e) {
          console.error('Error parsing departure for', playerTag, e);
        }
      }
    });
    
    return { players, notes, warnings, actions, playerNames };
  }, []);

  // Function to load player database from Supabase
  const loadPlayerDatabase = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      setLoading(true);
      
      // Always fetch current members fresh to ensure we have the latest data
      const membersToCheck = await fetchCurrentMembers();
      
      const playerRecords: PlayerRecord[] = [];
      const clanTag = '#2PR8R8V8P'; // Your clan tag

      // First, try to load from localStorage (your existing data)
      const localStorageData = loadFromLocalStorage();
      const playerNames = localStorageData.playerNames;
      
      // Then fetch from Supabase APIs (new data)
      const [notesResponse, warningsResponse, actionsResponse] = await Promise.all([
        fetch(`/api/player-notes?clanTag=${encodeURIComponent(clanTag)}`),
        fetch(`/api/player-warnings?clanTag=${encodeURIComponent(clanTag)}`),
        fetch(`/api/player-actions?clanTag=${encodeURIComponent(clanTag)}`)
      ]);

      const notesData = notesResponse.ok ? await notesResponse.json() : { data: [] };
      const warningsData = warningsResponse.ok ? await warningsResponse.json() : { data: [] };
      const actionsData = actionsResponse.ok ? await actionsResponse.json() : { data: [] };

      // Group data by player tag (combine localStorage and Supabase data)
      const playerDataMap = new Map<string, {
        notes: any[];
        warnings: any[];
        tenureActions: any[];
        departureActions: any[];
        name: string;
        lastUpdated: string;
      }>();

      // First, process localStorage data
      localStorageData.notes.forEach((note: any) => {
        const tag = note.playerTag;
        if (!playerDataMap.has(tag)) {
          playerDataMap.set(tag, {
            notes: [],
            warnings: [],
            tenureActions: [],
            departureActions: [],
            name: playerNames[tag] || 'Unknown Player',
            lastUpdated: note.timestamp
          });
        }
        const playerData = playerDataMap.get(tag)!;
        playerData.notes.push({
          id: `local_${Date.now()}_${Math.random()}`,
          timestamp: note.timestamp,
          note: note.note,
          customFields: note.customFields || {},
          source: 'localStorage'
        });
        if (note.timestamp > playerData.lastUpdated) {
          playerData.lastUpdated = note.timestamp;
        }
      });

      localStorageData.warnings.forEach((warning: any) => {
        const tag = warning.playerTag;
        if (!playerDataMap.has(tag)) {
          playerDataMap.set(tag, {
            notes: [],
            warnings: [],
            tenureActions: [],
            departureActions: [],
            name: playerNames[tag] || 'Unknown Player',
            lastUpdated: warning.timestamp
          });
        }
        const playerData = playerDataMap.get(tag)!;
        playerData.warnings.push({
          id: `local_warning_${Date.now()}_${Math.random()}`,
          timestamp: warning.timestamp,
          warningNote: warning.warningNote,
          isActive: warning.isActive,
          source: 'localStorage'
        });
        if (warning.timestamp > playerData.lastUpdated) {
          playerData.lastUpdated = warning.timestamp;
        }
      });

      localStorageData.actions.forEach((action: any) => {
        const tag = action.playerTag;
        if (!playerDataMap.has(tag)) {
          playerDataMap.set(tag, {
            notes: [],
            warnings: [],
            tenureActions: [],
            departureActions: [],
            name: playerNames[tag] || 'Unknown Player',
            lastUpdated: action.timestamp
          });
        }
        const playerData = playerDataMap.get(tag)!;
        if (action.actionType === 'tenure') {
          playerData.tenureActions.push({
            id: `local_tenure_${Date.now()}_${Math.random()}`,
            timestamp: action.timestamp,
            action: action.action,
            reason: action.reason,
            grantedBy: action.grantedBy,
            source: 'localStorage'
          });
        } else if (action.actionType === 'departure') {
          playerData.departureActions.push({
            id: `local_departure_${Date.now()}_${Math.random()}`,
            timestamp: action.timestamp,
            reason: action.reason,
            recordedBy: action.recordedBy,
            type: action.type,
            source: 'localStorage'
          });
        }
        if (action.timestamp > playerData.lastUpdated) {
          playerData.lastUpdated = action.timestamp;
        }
      });

      // Then process Supabase data (merge with localStorage)
      if (notesData.success && notesData.data) {
        notesData.data.forEach((note: any) => {
          const tag = note.player_tag;
          if (!playerDataMap.has(tag)) {
            playerDataMap.set(tag, {
              notes: [],
              warnings: [],
              tenureActions: [],
              departureActions: [],
              name: note.player_name || 'Unknown Player',
              lastUpdated: note.created_at
            });
          }
          const playerData = playerDataMap.get(tag)!;
          // Only add if not already present from localStorage
          const existingNote = playerData.notes.find(n => 
            n.source === 'localStorage' && n.timestamp === note.created_at
          );
          if (!existingNote) {
            playerData.notes.push({
              id: note.id,
              timestamp: note.created_at,
              note: note.note,
              customFields: note.custom_fields || {},
              source: 'supabase'
            });
          }
          if (note.created_at > playerData.lastUpdated) {
            playerData.lastUpdated = note.created_at;
          }
        });
      }

      // Process Supabase warnings (merge with localStorage)
      if (warningsData.success && warningsData.data) {
        warningsData.data.forEach((warning: any) => {
          const tag = warning.player_tag;
          if (!playerDataMap.has(tag)) {
            playerDataMap.set(tag, {
              notes: [],
              warnings: [],
              tenureActions: [],
              departureActions: [],
              name: warning.player_name || 'Unknown Player',
              lastUpdated: warning.created_at
            });
          }
          const playerData = playerDataMap.get(tag)!;
          if (warning.is_active) {
            // Only add if not already present from localStorage
            const existingWarning = playerData.warnings.find(w => 
              w.source === 'localStorage' && w.timestamp === warning.created_at
            );
            if (!existingWarning) {
              playerData.warnings.push({
                id: warning.id,
                timestamp: warning.created_at,
                warningNote: warning.warning_note,
                isActive: true,
                source: 'supabase'
              });
            }
            if (warning.created_at > playerData.lastUpdated) {
              playerData.lastUpdated = warning.created_at;
            }
          }
        });
      }

      // Process Supabase actions (merge with localStorage)
      if (actionsData.success && actionsData.data) {
        actionsData.data.forEach((action: any) => {
          const tag = action.player_tag;
          if (!playerDataMap.has(tag)) {
            playerDataMap.set(tag, {
              notes: [],
              warnings: [],
              tenureActions: [],
              departureActions: [],
              name: action.player_name || 'Unknown Player',
              lastUpdated: action.created_at
            });
          }
          const playerData = playerDataMap.get(tag)!;
          
          if (action.action_type === 'tenure') {
            // Only add if not already present from localStorage
            const existingAction = playerData.tenureActions.find(a => 
              a.source === 'localStorage' && a.timestamp === action.created_at
            );
            if (!existingAction) {
              playerData.tenureActions.push({
                id: action.id,
                timestamp: action.created_at,
                action: action.action,
                reason: action.reason,
                grantedBy: action.granted_by,
                source: 'supabase'
              });
            }
          } else if (action.action_type === 'departure') {
            // Only add if not already present from localStorage
            const existingAction = playerData.departureActions.find(a => 
              a.source === 'localStorage' && a.timestamp === action.created_at
            );
            if (!existingAction) {
              playerData.departureActions.push({
                id: action.id,
                timestamp: action.created_at,
                reason: action.reason,
                type: action.departure_type,
                recordedBy: action.recorded_by,
                source: 'supabase'
              });
            }
          }
          
          if (action.created_at > playerData.lastUpdated) {
            playerData.lastUpdated = action.created_at;
          }
        });
      }

      // Convert to PlayerRecord format
      playerDataMap.forEach((data, tag) => {
        const isCurrentMember = membersToCheck.includes(tag);
        
        playerRecords.push({
          tag,
          name: data.name,
          notes: data.notes,
          warning: data.warnings.length > 0 ? data.warnings[0] : undefined,
          tenureActions: data.tenureActions,
          departureActions: data.departureActions,
          lastUpdated: data.lastUpdated,
          isCurrentMember
        });
      });

      // Also add players from roster data who don't have notes yet
      try {
        const rosterData = localStorage.getItem('lastRoster:v3:#2PR8R8V8P');
        if (rosterData) {
          const roster = JSON.parse(rosterData);
          if (roster.roster && roster.roster.members) {
            roster.roster.members.forEach((member: any) => {
              const tag = member.tag;
              // Only add if not already in playerDataMap
              if (!playerDataMap.has(tag)) {
                const isCurrentMember = membersToCheck.includes(tag);
                playerRecords.push({
                  tag,
                  name: member.name,
                  notes: [],
                  warning: undefined,
                  tenureActions: [],
                  departureActions: [],
                  lastUpdated: roster.roster.date || '2025-10-09',
                  isCurrentMember
                });
              }
            });
          }
        }
      } catch (e) {
        console.error('Error loading roster data:', e);
      }

      // Sort by last updated
      playerRecords.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
      setPlayers(playerRecords);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load player database:', error);
      setLoading(false);
    }
  }, [fetchCurrentMembers]);

  useEffect(() => {
    loadPlayerDatabase();
  }, [loadPlayerDatabase]);

  // Cleanup effect to restore body scroll if component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Filter and sort players
  const filteredAndSortedPlayers = players
    .filter(player => {
      // Search filter
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.notes.some(note => 
          note.note.toLowerCase().includes(searchTerm.toLowerCase())
        );

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

  const handleRefresh = () => {
    loadPlayerDatabase();
  };

  // Note management functions
  const addNote = useCallback(async (playerTag: string, noteText: string) => {
    if (!noteText.trim()) return;

    try {
      const clanTag = '#2PR8R8V8P';
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag,
          playerTag,
          playerName,
          note: noteText.trim(),
          customFields: {},
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        loadPlayerDatabase();
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
  }, [selectedPlayer, loadPlayerDatabase]);

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
        loadPlayerDatabase();
        setEditingNote(null);
        setNewNoteText('');
      } else {
        console.error('Failed to edit note:', await response.text());
      }
    } catch (error) {
      console.error('Error editing note:', error);
    }
  }, [players, loadPlayerDatabase]);

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
        loadPlayerDatabase();
      } else {
        console.error('Failed to delete note:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  }, [players, loadPlayerDatabase]);

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
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag: '#2PR8R8V8P',
          playerTag: playerTag.trim(),
          playerName: playerName.trim(),
          note: noteText.trim(),
          customFields: {},
          createdBy: 'Player Database'
        })
      });

      const result = await response.json();
      if (result.success) {
        loadPlayerDatabase();
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
  }, [loadPlayerDatabase]);

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
      const clanTag = '#2PR8R8V8P';
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-warnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag,
          playerTag,
          playerName,
          warningNote: warningNote.trim(),
          createdBy: 'Current User'
        }),
      });

      if (response.ok) {
        loadPlayerDatabase();
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
  }, [selectedPlayer, loadPlayerDatabase]);

  const removePlayerWarning = useCallback(async (playerTag: string) => {
    try {
      const clanTag = '#2PR8R8V8P';
      
      const response = await fetch(`/api/player-warnings?clanTag=${encodeURIComponent(clanTag)}&playerTag=${encodeURIComponent(playerTag)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadPlayerDatabase();
      } else {
        console.error('Failed to remove warning:', await response.text());
      }
    } catch (error) {
      console.error('Error removing warning:', error);
    }
  }, [loadPlayerDatabase]);

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
      const clanTag = '#2PR8R8V8P';
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag,
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
        loadPlayerDatabase();
      } else {
        console.error('Failed to add tenure action:', await response.text());
      }
    } catch (error) {
      console.error('Error adding tenure action:', error);
    }
  }, [selectedPlayer, loadPlayerDatabase]);

  // Departure management functions
  const addDepartureAction = useCallback(async (playerTag: string, reason: string, type: 'voluntary' | 'involuntary' | 'inactive', recordedBy?: string) => {
    try {
      const clanTag = '#2PR8R8V8P';
      const playerName = selectedPlayer?.name || 'Unknown Player';
      
      const response = await fetch('/api/player-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag,
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
        loadPlayerDatabase();
      } else {
        console.error('Failed to add departure action:', await response.text());
      }
    } catch (error) {
      console.error('Error adding departure action:', error);
    }
  }, [selectedPlayer, loadPlayerDatabase]);

  // Fetch tenure data from the main system
  const fetchTenureData = useCallback(async (playerTag: string) => {
    try {
      // Try to get tenure data from the main system's localStorage
      const tenureKey = `tenure_${playerTag}`;
      const tenureData = localStorage.getItem(tenureKey);
      if (tenureData) {
        return JSON.parse(tenureData);
      }

      // Also check for tenure in the main roster data
      const response = await fetch('/api/v2/roster');
      if (response.ok) {
        const data = await response.json();
        const member = data.members?.find((m: any) => m.tag === playerTag);
        if (member && member.tenure_days > 0) {
          return {
            days: member.tenure_days,
            as_of: member.tenure_as_of,
            source: 'roster'
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch tenure data:', error);
    }
    return null;
  }, []);

  // Check for existing notes from the main system
  const checkForExistingNotes = useCallback((playerTag: string) => {
    try {
      // Check if there are notes in the main system's localStorage
      const mainNotesKey = `player_notes_${playerTag}`;
      const mainNotes = localStorage.getItem(mainNotesKey);
      if (mainNotes) {
        const notes = JSON.parse(mainNotes);
        if (Array.isArray(notes) && notes.length > 0) {
          return notes;
        }
      }
    } catch (error) {
      console.error('Failed to check for existing notes:', error);
    }
    return [];
  }, []);

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
        color: 'blue'
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
          icon: tenure.action === 'granted' ? '🏆' : '❌',
          color: tenure.action === 'granted' ? 'green' : 'red',
          details: { action: tenure.action, grantedBy: tenure.grantedBy }
        });
      });
    }

    // Add departure actions
    if (player.departureActions) {
      player.departureActions.forEach((departure, index) => {
        const typeEmoji = {
          'voluntary': '👋',
          'involuntary': '🚫',
          'inactive': '😴'
        };
        
        events.push({
          id: `departure-${index}`,
          type: 'departure',
          timestamp: departure.timestamp,
          title: `Departure Recorded (${departure.type})`,
          description: departure.reason,
          icon: typeEmoji[departure.type] || '👋',
          color: departure.type === 'voluntary' ? 'blue' : departure.type === 'involuntary' ? 'red' : 'orange',
          details: { type: departure.type, recordedBy: departure.recordedBy }
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
      // If former member, add a "left" event (using most recent note date or current date)
      const mostRecentNote = player.notes.reduce((newest, note) => 
        note.timestamp > newest ? note.timestamp : newest, 
        player.notes[0]?.timestamp || new Date().toISOString()
      );
      
      events.push({
        id: 'former-leave',
        type: 'leave',
        timestamp: mostRecentNote,
        title: 'Left Clan',
        description: 'No longer an active member',
        icon: '❌',
        color: 'orange'
      });
    }

    // Sort by timestamp (newest first)
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-text-primary">Player Database</h1>
            <p className="text-brand-text-secondary mt-1">
              View notes and history for all clan members (current and former)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-surface-primary border border-brand-border rounded-lg hover:bg-brand-surface-hover transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button 
              onClick={openAddPlayerModal}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Player</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
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
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">Total Players</p>
                <p className="text-xl font-semibold text-brand-text-primary">{players.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">Current Members</p>
                <p className="text-xl font-semibold text-brand-text-primary">
                  {players.filter(p => p.isCurrentMember).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <User className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">Former Members</p>
                <p className="text-xl font-semibold text-brand-text-primary">
                  {players.filter(p => !p.isCurrentMember).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">Players with Notes</p>
                <p className="text-xl font-semibold text-brand-text-primary">
                  {players.filter(p => p.notes.length > 0).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-brand-text-secondary">Total Notes</p>
                <p className="text-xl font-semibold text-brand-text-primary">
                  {players.reduce((sum, p) => sum + p.notes.length, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-brand-text-tertiary" />
              <input
                type="text"
                placeholder="Search players, tags, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-brand-text-secondary">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'current' | 'former')}
                  className="bg-brand-background border border-brand-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Players</option>
                  <option value="current">Current Members</option>
                  <option value="former">Former Members</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-brand-text-secondary">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'lastUpdated' | 'noteCount')}
                  className="bg-brand-background border border-brand-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="lastUpdated">Last Updated</option>
                  <option value="name">Name</option>
                  <option value="noteCount">Note Count</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 hover:bg-brand-surface-hover rounded-lg transition-colors"
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-brand-surface-primary border border-brand-border rounded-lg overflow-hidden">
          {filteredAndSortedPlayers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-brand-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-medium text-brand-text-primary mb-2">
                {searchTerm ? 'No players found' : 'No players in database'}
              </h3>
              <p className="text-brand-text-secondary">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'No players with notes found. Add notes to track player history and status.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-surface-secondary border-b border-brand-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Warning
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-brand-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredAndSortedPlayers.map((player) => (
                    <tr 
                      key={player.tag}
                      className="hover:bg-brand-surface-hover transition-colors cursor-pointer"
                      onClick={() => openPlayerModal(player)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-brand-text-primary">
                            {player.name}
                          </div>
                          <div className="text-sm text-brand-text-tertiary">
                            {player.tag}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          player.isCurrentMember 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {player.isCurrentMember ? 'Current' : 'Former'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {player.warning?.isActive ? (
                          <div className="flex items-center justify-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ⚠️ Warning
                            </span>
                          </div>
                        ) : (
                          <span className="text-brand-text-tertiary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="w-4 h-4 text-brand-text-tertiary" />
                          <span className="text-sm text-brand-text-primary">
                            {player.notes.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-brand-text-tertiary" />
                          <span className="text-sm text-brand-text-primary">
                            {safeLocaleDateString(new Date(player.lastUpdated))}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPlayerModal(player);
                          }}
                          className="text-brand-primary hover:text-brand-primary-hover text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Player Modal */}
        {showPlayerModal && selectedPlayer && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto overscroll-contain shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-brand-text-primary">
                  {selectedPlayer.name}
                </h2>
                <button
                  onClick={closePlayerModal}
                  className="text-brand-text-tertiary hover:text-brand-text-primary"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-brand-text-secondary">Player Tag</p>
                  <p className="text-brand-text-primary font-mono">{selectedPlayer.tag}</p>
                </div>
                
                <div>
                  <p className="text-sm text-brand-text-secondary">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    selectedPlayer.isCurrentMember 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {selectedPlayer.isCurrentMember ? 'Current Member' : 'Former Member'}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-brand-text-secondary mb-2">Warn on Return</p>
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
                        className="w-4 h-4 text-brand-primary bg-brand-background border-brand-border rounded focus:ring-brand-primary focus:ring-2"
                      />
                      <span className="text-sm text-brand-text-primary">
                        {selectedPlayer.warning?.isActive ? 'Warning Active' : 'No Warning Set'}
                      </span>
                    </label>
                    {selectedPlayer.warning?.isActive && (
                      <button
                        onClick={() => removePlayerWarning(selectedPlayer.tag)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove Warning
                      </button>
                    )}
                  </div>
                  {selectedPlayer.warning?.isActive && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800 font-medium mb-1">Warning Note:</p>
                      <p className="text-sm text-red-700">{selectedPlayer.warning.warningNote}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Set on {safeLocaleString(new Date(selectedPlayer.warning.timestamp))}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-brand-text-secondary">Notes ({selectedPlayer.notes.length})</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={openAddNoteModal}
                        className="flex items-center space-x-1 px-3 py-1 bg-brand-primary text-white text-xs rounded-lg hover:bg-brand-primary-hover transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Actions for Leaders */}
                  <div className="mb-4 p-3 bg-brand-surface-secondary border border-brand-border rounded-lg">
                    <p className="text-xs text-brand-text-secondary mb-2">Quick Actions</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          // Import existing data from main system
                          const existingNotes = checkForExistingNotes(selectedPlayer.tag);
                          const tenureData = await fetchTenureData(selectedPlayer.tag);
                          
                          if (existingNotes.length > 0) {
                            // Merge existing notes with current notes
                            const currentNotes = selectedPlayer.notes || [];
                            const mergedNotes = [...existingNotes, ...currentNotes];
                            
                            // Remove duplicates based on timestamp and note content
                            const uniqueNotes = mergedNotes.filter((note, index, self) => 
                              index === self.findIndex(n => n.timestamp === note.timestamp && n.note === note.note)
                            );
                            
                            // Update localStorage
                            const notesKey = `player_notes_${selectedPlayer.tag}`;
                            localStorage.setItem(notesKey, JSON.stringify(uniqueNotes));
                            
                            alert(`Imported ${existingNotes.length} existing notes from main system`);
                          }
                          
                          if (tenureData && tenureData.days > 0) {
                            // Add tenure action if not already recorded
                            const hasExistingTenure = selectedPlayer.tenureActions?.some(t => t.action === 'granted');
                            if (!hasExistingTenure) {
                              addTenureAction(selectedPlayer.tag, 'granted', `Imported from main system (${tenureData.days} days)`, 'System Import');
                              alert(`Imported tenure data: ${tenureData.days} days`);
                            }
                          }
                          
                          if (existingNotes.length === 0 && (!tenureData || tenureData.days === 0)) {
                            alert('No existing data found in main system');
                          }
                          
                          // Reload the player database
                          loadPlayerDatabase();
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        <span>🔄</span>
                        <span>Import Existing Data</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for granting tenure:');
                          if (reason) {
                            addTenureAction(selectedPlayer.tag, 'granted', reason, 'Current Leader');
                          }
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                      >
                        <span>🏆</span>
                        <span>Grant Tenure</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for revoking tenure:');
                          if (reason) {
                            addTenureAction(selectedPlayer.tag, 'revoked', reason, 'Current Leader');
                          }
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        <span>❌</span>
                        <span>Revoke Tenure</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Departure reason:');
                          const type = prompt('Type (voluntary/involuntary/inactive):');
                          if (reason && type && ['voluntary', 'involuntary', 'inactive'].includes(type)) {
                            addDepartureAction(selectedPlayer.tag, reason, type as any, 'Current Leader');
                          }
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                      >
                        <span>👋</span>
                        <span>Record Departure</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {selectedPlayer.notes.map((note, index) => (
                      <div key={index} className="bg-brand-background border border-brand-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-brand-text-tertiary">
                            {safeLocaleString(new Date(note.timestamp))}
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditNoteModal(note);
                              }}
                              className="p-1 text-brand-text-tertiary hover:text-brand-primary transition-colors"
                              title="Edit note"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this note?')) {
                                  deleteNote(selectedPlayer.tag, index);
                                }
                              }}
                              className="p-1 text-brand-text-tertiary hover:text-red-500 transition-colors"
                              title="Delete note"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-brand-text-primary">{note.note}</p>
                        {Object.keys(note.customFields).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(note.customFields).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="text-brand-text-secondary">{key}:</span>
                                <span className="text-brand-text-primary ml-1">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Player Timeline */}
                <div>
                  <p className="text-sm text-brand-text-secondary mb-3">Player History</p>
                  <div className="max-h-64 overflow-y-auto border border-brand-border rounded-lg bg-brand-background">
                    <div className="p-4">
                      {generatePlayerTimeline(selectedPlayer).map((event, index) => (
                        <div key={event.id} className="relative">
                          <div className="flex items-start space-x-3 pb-4">
                            <div className="relative flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                                event.color === 'green' ? 'bg-green-100 text-green-600' :
                                event.color === 'red' ? 'bg-red-100 text-red-600' :
                                event.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {event.icon}
                              </div>
                              {index < generatePlayerTimeline(selectedPlayer).length - 1 && (
                                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-brand-border"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-brand-text-primary">
                                  {event.title}
                                </p>
                                <p className="text-xs text-brand-text-tertiary">
                                  {safeLocaleString(new Date(event.timestamp))}
                                </p>
                              </div>
                              <p className="text-sm text-brand-text-secondary mt-1">
                                {event.description}
                              </p>
                              {event.details && (
                                <div className="mt-1 text-xs text-brand-text-tertiary">
                                  {event.details.grantedBy && (
                                    <span>By: {event.details.grantedBy}</span>
                                  )}
                                  {event.details.recordedBy && (
                                    <span>Recorded by: {event.details.recordedBy}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {generatePlayerTimeline(selectedPlayer).length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-sm text-brand-text-tertiary">No history available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Note Modal */}
        {showAddNoteModal && selectedPlayer && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-brand-text-primary">
                  {editingNote ? 'Edit Note' : 'Add Note'}
                </h2>
                <button
                  onClick={closeNoteModal}
                  className="text-brand-text-tertiary hover:text-brand-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-brand-text-secondary mb-2">
                    Note for {selectedPlayer.name}
                  </p>
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Enter your note here..."
                    className="w-full h-32 px-3 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                    autoFocus
                  />
                </div>
                
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={closeNoteModal}
                    className="px-4 py-2 text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingNote) {
                        const noteIndex = selectedPlayer.notes.findIndex(n => n.timestamp === editingNote.timestamp);
                        editNote(selectedPlayer.tag, noteIndex, newNoteText);
                      } else {
                        addNote(selectedPlayer.tag, newNoteText);
                      }
                    }}
                    disabled={!newNoteText.trim()}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingNote ? 'Update Note' : 'Add Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Player Modal */}
        {showAddPlayerModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-brand-text-primary">Add New Player</h2>
                <button
                  onClick={closeAddPlayerModal}
                  className="text-brand-text-tertiary hover:text-brand-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-brand-text-secondary mb-2">
                    Player Tag
                  </label>
                  <input
                    type="text"
                    value={newPlayerTag}
                    onChange={(e) => setNewPlayerTag(e.target.value)}
                    placeholder="e.g., #ABC123DEF"
                    className="w-full px-3 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-brand-text-secondary mb-2">
                    Player Name
                  </label>
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="e.g., PlayerName"
                    className="w-full px-3 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-brand-text-secondary mb-2">
                    Initial Note
                  </label>
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Enter initial note for this player..."
                    className="w-full h-24 px-3 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                  />
                </div>
                
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={closeAddPlayerModal}
                    className="px-4 py-2 text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addNewPlayer(newPlayerTag, newPlayerName, newNoteText)}
                    disabled={!newPlayerTag.trim() || !newPlayerName.trim() || !newNoteText.trim()}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Player
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {showWarningModal && selectedPlayer && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="bg-brand-surface-primary border border-brand-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-brand-text-primary">Set Warning for Return</h2>
                <button
                  onClick={closeWarningModal}
                  className="text-brand-text-tertiary hover:text-brand-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This player will be flagged with a special warning message when they try to return to the clan.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-brand-text-secondary mb-2">
                    Warning Note for {selectedPlayer.name}
                  </label>
                  <textarea
                    value={warningNoteText}
                    onChange={(e) => setWarningNoteText(e.target.value)}
                    placeholder="Enter the warning message that will be shown when this player tries to return..."
                    className="w-full h-32 px-3 py-2 bg-brand-background border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                    autoFocus
                  />
                  <p className="text-xs text-brand-text-tertiary mt-1">
                    This note will be displayed prominently when the player attempts to rejoin.
                  </p>
                </div>
                
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={closeWarningModal}
                    className="px-4 py-2 text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPlayerWarning(selectedPlayer.tag, warningNoteText)}
                    disabled={!warningNoteText.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set Warning
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
