"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CreatePlayerNoteModalProps {
  onClose: () => void;
  prefilledPlayerTag?: string;
  prefilledPlayerName?: string;
}

export default function CreatePlayerNoteModal({ 
  onClose, 
  prefilledPlayerTag, 
  prefilledPlayerName 
}: CreatePlayerNoteModalProps) {
  const [playerTag, setPlayerTag] = useState(prefilledPlayerTag || "");
  const [playerName, setPlayerName] = useState(prefilledPlayerName || "");
  const [note, setNote] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  
  // If player info is prefilled, disable those fields
  const isPlayerPrefilled = !!prefilledPlayerTag;

  const savePlayerNote = () => {
    if (!playerTag.trim() || !note.trim()) {
      alert("Please enter both player tag and note");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const noteData = {
        timestamp,
        note: note.trim(),
        customFields: { ...customFields }
      };

      // Store in localStorage with timestamped notes
      const notesKey = `player_notes_${playerTag.toUpperCase()}`;
      let existingNotes = JSON.parse(localStorage.getItem(notesKey) || "[]");
      
      // Migration: If we have old single-note format, convert it
      if (typeof existingNotes === "string" && existingNotes.trim()) {
        // Old format: single string note
        const oldNote = existingNotes;
        const oldFieldsKey = `player_fields_${playerTag.toUpperCase()}`;
        const oldFields = JSON.parse(localStorage.getItem(oldFieldsKey) || "{}");
        
        // Convert to new timestamped format
        const migratedNote = {
          timestamp: new Date().toISOString(),
          note: oldNote,
          customFields: oldFields
        };
        
        existingNotes = [migratedNote];
        
        // Clean up old format
        localStorage.removeItem(oldFieldsKey);
        
        console.log(`Migrated old note format for player ${playerTag}`);
      }
      
      existingNotes.push(noteData);
      localStorage.setItem(notesKey, JSON.stringify(existingNotes));

      // Store player name for reference
      const nameKey = `player_name_${playerTag.toUpperCase()}`;
      if (playerName.trim()) {
        localStorage.setItem(nameKey, playerName.trim());
      }

      alert("Player note saved successfully!");
      onClose();
    } catch (error) {
      console.error('Failed to save player note:', error);
      alert("Failed to save player note");
    }
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
          {isPlayerPrefilled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
              <p className="text-sm text-blue-800">
                ℹ️ <strong>Note:</strong> Adding note for <strong>{playerName || playerTag}</strong>
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-2">Player Tag *</label>
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
              placeholder="#2PR8R8V8P"
              disabled={isPlayerPrefilled}
              className={`w-full border rounded-lg px-3 py-2 ${isPlayerPrefilled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Player's display name (optional)"
              disabled={isPlayerPrefilled}
              className={`w-full border rounded-lg px-3 py-2 ${isPlayerPrefilled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={savePlayerNote}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
