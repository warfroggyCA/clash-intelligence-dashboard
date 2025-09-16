/**
 * PlayerProfileModal Component
 * 
 * A comprehensive modal for displaying detailed player information.
 * Handles player data display, notes, and interaction features.
 * 
 * Features:
 * - Detailed player statistics
 * - Hero level display
 * - Player notes management
 * - Custom fields
 * - Responsive design
 * - Accessibility features
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState, useEffect } from 'react';
import { Member, Roster } from '@/types';
import { Modal } from '@/components/ui';
import { Button, SuccessButton, DangerButton } from '@/components/ui';
import LeadershipGuard from '@/components/LeadershipGuard';
import { 
  calculateRushPercentage, 
  calculateDonationBalance, 
  calculateActivityScore,
  getTownHallLevel,
  isRushed,
  isVeryRushed,
  isNetReceiver,
  isLowDonator
} from '@/lib/business/calculations';

// =============================================================================
// TYPES
// =============================================================================

export interface PlayerProfileModalProps {
  member: Member;
  clanTag: string;
  roster: Roster | null;
  onClose: () => void;
}

interface PlayerNote {
  timestamp: string;
  note: string;
  addedBy?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  member,
  clanTag,
  roster,
  onClose
}) => {
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  // Calculate player metrics
  const th = getTownHallLevel(member);
  const rushPercent = calculateRushPercentage(member);
  const donationBalance = calculateDonationBalance(member);
  const activity = calculateActivityScore(member);
  const isRushedPlayer = isRushed(member);
  const isVeryRushedPlayer = isVeryRushed(member);
  const isNetReceiverPlayer = isNetReceiver(member);
  const isLowDonatorPlayer = isLowDonator(member);

  // Load player notes and custom fields
  useEffect(() => {
    const loadPlayerData = () => {
      try {
        const notesKey = `player_notes_${member.tag.toUpperCase()}`;
        const fieldsKey = `player_fields_${member.tag.toUpperCase()}`;
        
        const savedNotes = localStorage.getItem(notesKey);
        const savedFields = localStorage.getItem(fieldsKey);
        
        if (savedNotes) {
          setNotes(JSON.parse(savedNotes));
        }
        
        if (savedFields) {
          setCustomFields(JSON.parse(savedFields));
        }
      } catch (error) {
        console.error('Failed to load player data:', error);
      }
    };

    loadPlayerData();
  }, [member.tag]);

  const handleSaveNote = () => {
    if (!newNote.trim()) return;

    const note: PlayerNote = {
      timestamp: new Date().toISOString(),
      note: newNote.trim(),
      addedBy: 'Current User' // Would be replaced with actual user
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNewNote('');
    setIsEditing(false);

    // Save to localStorage
    try {
      const notesKey = `player_notes_${member.tag.toUpperCase()}`;
      localStorage.setItem(notesKey, JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleSaveCustomFields = () => {
    try {
      const fieldsKey = `player_fields_${member.tag.toUpperCase()}`;
      localStorage.setItem(fieldsKey, JSON.stringify(customFields));
    } catch (error) {
      console.error('Failed to save custom fields:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      // Check if the date string contains invalid characters
      if (typeof dateString !== 'string' || dateString.includes('U') || dateString.includes('u')) {
        console.error('Invalid date string contains U character:', dateString);
        return 'Invalid Date';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateString);
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${member.name} (${member.tag})`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Player Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Town Hall:</span>
                  <span className="font-semibold">TH{th}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trophies:</span>
                  <span className="font-semibold">{member.trophies?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span className="font-semibold capitalize">{member.role || 'Member'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tenure:</span>
                  <span className="font-semibold">
                    {member.tenure_days || member.tenure || 0} days
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Levels */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Hero Levels</h3>
              <div className="space-y-2">
                {member.bk && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barbarian King:</span>
                    <span className="font-semibold">{member.bk}</span>
                  </div>
                )}
                {member.aq && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Archer Queen:</span>
                    <span className="font-semibold">{member.aq}</span>
                  </div>
                )}
                {member.gw && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grand Warden:</span>
                    <span className="font-semibold">{member.gw}</span>
                  </div>
                )}
                {member.rc && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Royal Champion:</span>
                    <span className="font-semibold">{member.rc}</span>
                  </div>
                )}
                {member.mp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Master Builder:</span>
                    <span className="font-semibold">{member.mp}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Player Status Indicators */}
          <div className="mt-4 flex flex-wrap gap-2">
            {isRushedPlayer && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                isVeryRushedPlayer 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isVeryRushedPlayer ? 'Very Rushed' : 'Rushed'} ({rushPercent}%)
              </span>
            )}
            {isNetReceiverPlayer && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                Net Receiver
              </span>
            )}
            {isLowDonatorPlayer && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                Low Donator
              </span>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              activity.level === 'Very Active' ? 'bg-green-100 text-green-800' :
              activity.level === 'Active' ? 'bg-blue-100 text-blue-800' :
              activity.level === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
              activity.level === 'Low' ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800'
            }`}>
              {activity.level}
            </span>
          </div>
        </div>

        {/* Donation Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Donation Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {member.donations?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-600">Given</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {member.donationsReceived?.toLocaleString() || 0}
              </div>
              <div className="text-sm text-gray-600">Received</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                donationBalance.balance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {donationBalance.balance > 0 ? '-' : '+'}{Math.abs(donationBalance.balance).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Balance</div>
            </div>
          </div>
        </div>

        {/* Player Notes */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Player Notes</h3>
            <LeadershipGuard
              requiredPermission="canModifyClanData"
              fallback={null}
            >
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant="outline"
                size="sm"
              >
                {isEditing ? 'Cancel' : 'Add Note'}
              </Button>
            </LeadershipGuard>
          </div>

          {/* Display existing notes */}
          <div className="space-y-3 mb-4">
            {notes.length === 0 ? (
              <p className="text-gray-500 italic">No notes yet</p>
            ) : (
              notes.map((note, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(note.timestamp)}
                    </span>
                    {note.addedBy && (
                      <span className="text-xs text-gray-400">
                        by {note.addedBy}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800">{note.note}</p>
                </div>
              ))
            )}
          </div>

          {/* Add new note */}
          {isEditing && (
            <div className="space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this player..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <div className="flex gap-2">
                <SuccessButton
                  onClick={handleSaveNote}
                  disabled={!newNote.trim()}
                  size="sm"
                >
                  Save Note
                </SuccessButton>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setNewNote('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Custom Fields */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Custom Fields</h3>
          <div className="space-y-3">
            {Object.entries(customFields).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-600 w-32">
                  {key}:
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setCustomFields(prev => ({
                    ...prev,
                    [key]: e.target.value
                  }))}
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="New field name"
                className="w-32 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    const fieldName = input.value.trim();
                    if (fieldName && !customFields[fieldName]) {
                      setCustomFields(prev => ({
                        ...prev,
                        [fieldName]: ''
                      }));
                      input.value = '';
                    }
                  }
                }}
              />
              <span className="text-sm text-gray-500">Press Enter to add</span>
            </div>
            <Button
              onClick={handleSaveCustomFields}
              variant="outline"
              size="sm"
            >
              Save Fields
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PlayerProfileModal;
