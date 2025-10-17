"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag } from '@/lib/tags';

interface CreatePlayerNoteModalProps {
  onClose: () => void;
  defaultTag?: string;
  defaultName?: string;
  lockTag?: boolean;
  onSaved?: () => void;
}

export default function CreatePlayerNoteModal({ onClose, defaultTag, defaultName, lockTag = false, onSaved }: CreatePlayerNoteModalProps) {
  const [playerTag, setPlayerTag] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [note, setNote] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useDashboardStore((state) => state.currentUser);
  const storeClanTag = useDashboardStore((state) => state.clanTag || state.homeClan);

  // Initialize defaults when provided
  useEffect(() => {
    if (defaultTag && !playerTag) {
      const up = defaultTag.toUpperCase();
      setPlayerTag(up.startsWith('#') ? up : `#${up}`);
    }
    if (defaultName && !playerName) {
      setPlayerName(defaultName);
    }
  }, [defaultTag, defaultName, playerTag, playerName]);

  const resolvedClanTag = useMemo(() => normalizeTag(storeClanTag || '') || '#2PR8R8V8P', [storeClanTag]);

  const savePlayerNote = () => {
    if (!playerTag.trim() || !note.trim()) {
      alert("Please enter both player tag and note");
      return;
    }

    const normalizedTag = normalizeTag(playerTag);
    if (!normalizedTag) {
      setError("Player tag is invalid. Add a # and try again.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      clanTag: resolvedClanTag,
      playerTag: normalizedTag,
      playerName: playerName.trim() || undefined,
      note: note.trim(),
      customFields: Object.entries(customFields).reduce<Record<string, string>>((acc, [key, value]) => {
        const trimmedKey = key.trim();
        if (trimmedKey) {
          acc[trimmedKey] = value.trim();
        }
        return acc;
      }, {}),
      createdBy: currentUser?.email || currentUser?.id || undefined,
    };

    fetch('/api/player-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to create note (${res.status})`);
        }
        onSaved?.();
        onClose();
      })
      .catch((err: any) => {
        console.error('Failed to save player note:', err);
        setError(err?.message || 'Failed to save player note');
      })
      .finally(() => setSaving(false));
  };

  const addCustomField = () => {
    const fieldName = prompt("Enter field name:");
    if (fieldName && !customFields[fieldName]) {
      setCustomFields(prev => ({ ...prev, [fieldName]: "" }));
    }
  };

  const removeCustomField = (fieldName: string) => {
    setCustomFields(prev => {
      const newFields = { ...prev };
      delete newFields[fieldName];
      return newFields;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Create Player Note</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Player Tag *</label>
            {lockTag ? (
              <div className="flex items-center gap-2">
                <span className="font-mono px-2 py-1 rounded bg-gray-100 text-gray-700">
                  {playerTag || defaultTag}
                </span>
                <span className="text-xs text-gray-500">Pre-filled from selected player</span>
              </div>
            ) : (
              <input
                type="text"
                value={playerTag}
                onChange={(e) => {
                  let value = e.target.value.toUpperCase();
                  // Auto-add # if not present
                  if (value && !value.startsWith('#')) {
                    value = '#' + value;
                  }
                  setPlayerTag(value);
                }}
                placeholder="2PR8R8V8P"
                className="w-full border rounded-lg px-3 py-2"
              />
            )}
          </div>

          <p className="text-xs text-gray-500">
            Notes are saved to Supabase for clan <span className="font-mono">{resolvedClanTag}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium mb-2">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Player's display name (optional)"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Note *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your note about this player..."
              className="w-full border rounded-lg px-3 py-2 h-32"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Custom Fields</label>
              <button
                onClick={addCustomField}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add Field
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(customFields).map(([fieldName, fieldValue]) => (
                <div key={fieldName} className="flex items-center space-x-2">
                  <span className="font-medium text-sm w-24">{fieldName}:</span>
                  <input
                    type="text"
                    value={fieldValue}
                    onChange={(e) => setCustomFields(prev => ({ ...prev, [fieldName]: e.target.value }))}
                    className="flex-1 border rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => removeCustomField(fieldName)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {Object.keys(customFields).length === 0 && (
                <p className="text-sm text-gray-500">No custom fields added yet.</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={savePlayerNote}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
