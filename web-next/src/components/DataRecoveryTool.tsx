"use client";

import React, { useState, useEffect } from 'react';

interface RecoveryResult {
  found: number;
  migrated: number;
  errors: string[];
  recoveredPlayers: string[];
}

export default function DataRecoveryTool() {
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const recoverData = () => {
    if (typeof window === 'undefined') return;
    
    setIsRecovering(true);
    const errors: string[] = [];
    const recoveredPlayers: string[] = [];
    let found = 0;
    let migrated = 0;

    try {
      // Get all localStorage keys
      const allKeys = Object.keys(localStorage);
      
      // Look for old format notes (various patterns)
      const oldFormatKeys = allKeys.filter(key => 
        key.startsWith('player_notes_') || 
        key.startsWith('playerNotes') ||
        key.includes('player') && key.includes('note')
      );

      console.log('Found potential old format keys:', oldFormatKeys);

      for (const key of oldFormatKeys) {
        try {
          const value = localStorage.getItem(key);
          if (!value) continue;

          found++;
          
          // Try to parse as JSON
          let parsedValue;
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // If it's not JSON, it might be old string format
            if (typeof value === 'string' && value.trim()) {
              // Extract player tag from key
              let playerTag = key.replace('player_notes_', '').replace('playerNotes', '');
              if (playerTag.includes('_')) {
                playerTag = playerTag.split('_')[0];
              }
              
              if (playerTag) {
                // Convert old string format to new format
                const newKey = `player_notes_${playerTag.toUpperCase()}`;
                const migratedNote = {
                  timestamp: new Date().toISOString(),
                  note: value,
                  customFields: {}
                };
                
                // Check if we already have new format data
                const existingNew = localStorage.getItem(newKey);
                if (!existingNew) {
                  localStorage.setItem(newKey, JSON.stringify([migratedNote]));
                  migrated++;
                  recoveredPlayers.push(playerTag);
                  console.log(`Migrated old format for ${playerTag}`);
                }
              }
            }
            continue;
          }

          // If it's an array, it might already be new format
          if (Array.isArray(parsedValue)) {
            // Check if this is new format (has timestamp property)
            const hasTimestamps = parsedValue.some((item: any) => item.timestamp);
            if (hasTimestamps) {
              console.log(`Key ${key} is already new format`);
              continue;
            }
            
            // Old array format - convert to new format
            let playerTag = key.replace('player_notes_', '');
            if (playerTag.includes('_')) {
              playerTag = playerTag.split('_')[0];
            }
            
            if (playerTag) {
              const newKey = `player_notes_${playerTag.toUpperCase()}`;
              const migratedNotes = parsedValue.map((note: any) => ({
                timestamp: new Date().toISOString(),
                note: typeof note === 'string' ? note : note.note || '',
                customFields: note.customFields || {}
              }));
              
              localStorage.setItem(newKey, JSON.stringify(migratedNotes));
              migrated++;
              recoveredPlayers.push(playerTag);
              console.log(`Migrated array format for ${playerTag}`);
            }
          }

        } catch (error) {
          const errorMsg = `Failed to process key ${key}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      setResult({
        found,
        migrated,
        errors,
        recoveredPlayers
      });

    } catch (error) {
      errors.push(`Recovery failed: ${error}`);
      setResult({
        found: 0,
        migrated: 0,
        errors,
        recoveredPlayers: []
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const clearAllPlayerData = () => {
    if (typeof window === 'undefined') return;
    
    if (!confirm('This will delete ALL player notes and data. Are you sure?')) {
      return;
    }

    const allKeys = Object.keys(localStorage);
    const playerKeys = allKeys.filter(key => 
      key.startsWith('player_') || 
      key.includes('player') && (key.includes('note') || key.includes('field'))
    );

    playerKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    alert(`Cleared ${playerKeys.length} player data entries`);
    setResult(null);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">🔧 Data Recovery Tool</h2>
      
      <div className="space-y-4">
        <p className="text-gray-600">
          This tool will scan your browser storage for any old-format player notes and attempt to recover them.
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={recoverData}
            disabled={isRecovering}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isRecovering ? 'Recovering...' : '🔍 Scan & Recover Data'}
          </button>
          
          <button
            onClick={clearAllPlayerData}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            🗑️ Clear All Player Data
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Recovery Results:</h3>
            <ul className="space-y-1 text-sm">
              <li>📊 Found {result.found} potential data entries</li>
              <li>✅ Successfully migrated {result.migrated} entries</li>
              <li>👥 Recovered {result.recoveredPlayers.length} players</li>
              {result.errors.length > 0 && (
                <li>❌ {result.errors.length} errors occurred</li>
              )}
            </ul>
            
            {result.recoveredPlayers.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Recovered Players:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.recoveredPlayers.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-red-600">Errors:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
