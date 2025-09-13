import React, { useState } from 'react';

interface AccessSetupProps {
  clanTag: string;
  clanName: string;
  onAccessCreated: (ownerPassword: string) => void;
  onClose: () => void;
}

export default function AccessSetup({ clanTag, clanName, onAccessCreated, onClose }: AccessSetupProps) {
  const [setupData, setSetupData] = useState({
    ownerName: '',
    ownerCocTag: ''
  });
  const [loading, setLoading] = useState(false);

  const initializeAccess = async () => {
    if (!setupData.ownerName.trim()) {
      alert('Owner name is required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/access/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          clanName,
          ownerName: setupData.ownerName,
          ownerCocTag: setupData.ownerCocTag
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const ownerPassword = data.ownerAccess.password;
        
        // Store the owner password securely (in production, this would be handled differently)
        localStorage.setItem(`clan_manager_password_${clanTag}`, ownerPassword);
        
        alert(`Access system initialized! Your owner password is: ${ownerPassword}\n\nSave this password - you'll need it to manage access for your clan.`);
        
        onAccessCreated(ownerPassword);
      } else {
        alert(`Error initializing access: ${data.error}`);
      }
    } catch (error) {
      console.error('Error initializing access:', error);
      alert('Failed to initialize access system');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Setup Access Control</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• You'll get a unique password as the clan owner</li>
              <li>• You can add clan members and assign them individual passwords</li>
              <li>• Each member gets their own access level (viewer, member, elder, etc.)</li>
              <li>• You can revoke access instantly when someone leaves</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name (Clan Owner) *
            </label>
            <input
              type="text"
              value={setupData.ownerName}
              onChange={(e) => setSetupData(prev => ({ ...prev, ownerName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your CoC Player Tag (Optional)
            </label>
            <input
              type="text"
              value={setupData.ownerCocTag}
              onChange={(e) => setSetupData(prev => ({ ...prev, ownerCocTag: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="#ABC123XYZ"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={initializeAccess}
            disabled={loading || !setupData.ownerName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting up...' : 'Setup Access Control'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p><strong>Note:</strong> This will create a secure access system for your clan. You'll receive a password that you must save to manage access for your members.</p>
        </div>
      </div>
    </div>
  );
}
