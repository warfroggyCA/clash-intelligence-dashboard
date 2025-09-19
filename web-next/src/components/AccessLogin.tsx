import React, { useState } from 'react';
import { getAccessLevelPermissions } from '../lib/access-management';

interface AccessLoginProps {
  clanTag: string;
  clanName: string;
  onAccessGranted: (accessMember: any, permissions: any) => void;
  onClose: () => void;
}

export default function AccessLogin({ clanTag, clanName, onAccessGranted, onClose }: AccessLoginProps) {
  const [accessPassword, setAccessPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessPassword.trim()) {
      setError('Please enter your access password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/access/list?clanTag=${encodeURIComponent(clanTag)}&accessPassword=${accessPassword.trim()}`);
      const payload = await response.json();
      
      if (payload.success) {
        const accessMember = payload.data?.accessMember;
        if (!accessMember) {
          setError('Failed to load access details.');
          return;
        }

        const permissions = payload.data?.permissions || getAccessLevelPermissions(accessMember.accessLevel);

        onAccessGranted(accessMember, permissions);
      } else {
        setError(payload.error || 'Invalid access password');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setError('Failed to verify access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Access Required</h2>
            <p className="text-gray-600">{clanName} ({clanTag})</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🔒</div>
              <div>
                <h3 className="font-semibold text-yellow-900">Clan Access Required</h3>
                <p className="text-sm text-yellow-800 mt-1">
                  Enter your individual access password to view this clan's dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Password
            </label>
            <input
              type="password"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-lg tracking-wider"
              placeholder="Enter your 8-character password"
              maxLength={8}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your password from your clan leader
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <div className="text-red-400 mr-2">⚠️</div>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !accessPassword.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-6 text-xs text-gray-500">
          <p><strong>Need access?</strong> Contact your clan leader to get your individual access password.</p>
          <p className="mt-1"><strong>Lost password?</strong> Ask your clan leader to reset it for you.</p>
        </div>
      </div>
    </div>
  );
}
