"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { Settings, Home, Users, Palette, Bell, Shield, Database, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    homeClan,
    clanTag,
    setHomeClan,
    setClanTag,
    loadRoster,
    userRole,
    setUserRole,
  } = useDashboardStore();

  const [newHomeClan, setNewHomeClan] = useState(homeClan || '');
  const [newClanTag, setNewClanTag] = useState(clanTag || '');
  const [newUserRole, setNewUserRole] = useState(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Update local state when props change
  useEffect(() => {
    setNewHomeClan(homeClan || '');
    setNewClanTag(clanTag || '');
    setNewUserRole(userRole);
  }, [homeClan, clanTag, userRole]);

  const handleSaveHomeClan = async () => {
    if (!newHomeClan.trim()) {
      setMessage('Please enter a clan tag');
      return;
    }

    const normalizedTag = normalizeTag(newHomeClan);
    if (!isValidTag(normalizedTag)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      setHomeClan(normalizedTag);
      setMessage('Home clan updated successfully!');
      
      // Auto-load the new home clan if no current clan is loaded
      if (!clanTag) {
        await loadRoster(normalizedTag);
      }
    } catch (error) {
      setMessage('Failed to update home clan');
      console.error('Error updating home clan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToClan = async () => {
    if (!newClanTag.trim()) {
      setMessage('Please enter a clan tag');
      return;
    }

    const normalizedTag = normalizeTag(newClanTag);
    if (!isValidTag(normalizedTag)) {
      setMessage('Please enter a valid clan tag (e.g., #2PR8R8V8P)');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      setClanTag(normalizedTag);
      await loadRoster(normalizedTag);
      setMessage('Clan switched successfully!');
    } catch (error) {
      setMessage('Failed to switch clan');
      console.error('Error switching clan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHomeClan = async () => {
    if (!homeClan) {
      setMessage('No home clan set');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      setClanTag(homeClan);
      await loadRoster(homeClan);
      setMessage('Home clan loaded successfully!');
    } catch (error) {
      setMessage('Failed to load home clan');
      console.error('Error loading home clan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUserRole = () => {
    setUserRole(newUserRole);
    setMessage('User role updated successfully!');
  };

  const clearMessage = () => {
    setMessage('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto w-full max-w-full">
        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-lg ${
            message.includes('successfully') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{message}</span>
              <button
                onClick={clearMessage}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Clan Management - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Home Clan Management */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Home className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-900">Home Clan Management</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 space-y-3 w-full overflow-hidden">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Set Home Clan
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newHomeClan}
                    onChange={(e) => setNewHomeClan(e.target.value)}
                    placeholder="#2PR8R8V8P"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
                  />
                  <button
                    onClick={handleSaveHomeClan}
                    disabled={isLoading}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Current home clan: <span className="font-mono">{homeClan || 'None'}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Actions
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLoadHomeClan}
                    disabled={isLoading || !homeClan}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Load Home Clan
                  </button>
                  <button
                    onClick={() => {
                      setNewClanTag(homeClan || '');
                      setMessage('Home clan tag copied to switch field');
                    }}
                    disabled={!homeClan}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Copy to Switch
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Clan Switching */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-purple-600" />
              <h3 className="text-base font-semibold text-gray-900">Clan Switching</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 w-full overflow-hidden">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Switch to Clan
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newClanTag}
                    onChange={(e) => setNewClanTag(e.target.value)}
                    placeholder="#2PR8R8V8P"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-0"
                  />
                  <button
                    onClick={handleSwitchToClan}
                    disabled={isLoading}
                    className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Switch'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Current clan: <span className="font-mono">{clanTag || 'None'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* User Role */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-orange-600" />
            <h3 className="text-base font-semibold text-gray-900">User Role</h3>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Role
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="member">Member</option>
                <option value="elder">Elder</option>
                <option value="coLeader">Co-Leader</option>
                <option value="leader">Leader</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Current role: <span className="font-semibold capitalize">{userRole}</span>
              </p>
              <button
                onClick={handleSaveUserRole}
                className="mt-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                Save Role
              </button>
            </div>
          </div>
        </div>

        {/* Future Settings Placeholders - Compact */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Coming Soon</h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Palette className="w-3 h-3" />
              <span>Appearance & Themes</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Bell className="w-3 h-3" />
              <span>Notifications</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Database className="w-3 h-3" />
              <span>Data Management</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
