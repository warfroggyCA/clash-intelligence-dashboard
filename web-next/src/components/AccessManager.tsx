import React, { useState, useEffect } from 'react';
import { safeLocaleDateString } from '@/lib/date';
import { AccessMember, AccessLevel, getAccessLevelDisplayName, canManageAccessLevel } from '../lib/access-management';

interface AccessManagerProps {
  clanTag: string;
  clanName: string;
  onClose: () => void;
}

interface AccessMemberWithPassword extends AccessMember {
  showPassword?: boolean;
}

export default function AccessManager({ clanTag, clanName, onClose }: AccessManagerProps) {
  const [accessMembers, setAccessMembers] = useState<AccessMemberWithPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    cocPlayerTag: '',
    email: '',
    accessLevel: 'member' as AccessLevel,
    notes: ''
  });

  useEffect(() => {
    loadAccessMembers();
  }, [clanTag]);

  const loadAccessMembers = async () => {
    try {
      setLoading(true);
      // For now, we'll simulate loading - in production this would use the actual API
      // You'd need to store the manager's access password somewhere secure
      const managerPassword = localStorage.getItem(`clan_manager_password_${clanTag}`);
      
      if (!managerPassword) {
        alert('Manager access required. Please contact the clan leader.');
        return;
      }

      const response = await fetch(`/api/access/list?clanTag=${encodeURIComponent(clanTag)}&accessPassword=${managerPassword}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });

      const data = await response.json();
      
      if (data.success) {
        setAccessMembers(data.accessMembers);
      } else {
        alert(`Error loading access members: ${data.error}`);
      }
    } catch (error) {
      console.error('Error loading access members:', error);
      alert('Failed to load access members');
    } finally {
      setLoading(false);
    }
  };

  const addAccessMember = async () => {
    if (!newMember.name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      const managerPassword = localStorage.getItem(`clan_manager_password_${clanTag}`);
      const response = await fetch(`/api/access/list?clanTag=${encodeURIComponent(clanTag)}&accessPassword=${managerPassword}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          ...newMember
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Show the generated password to the manager
        const password = data.accessMember.password;
        alert(`Access granted! Share this password with ${newMember.name}: ${password}`);
        
        // Reset form and reload list
        setNewMember({
          name: '',
          cocPlayerTag: '',
          email: '',
          accessLevel: 'member' as AccessLevel,
          notes: ''
        });
        setShowAddForm(false);
        loadAccessMembers();
      } else {
        alert(`Error adding member: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding access member:', error);
      alert('Failed to add access member');
    }
  };

  const revokeAccess = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${memberName}?`)) {
      return;
    }

    try {
      const managerPassword = localStorage.getItem(`clan_manager_password_${clanTag}`);
      const response = await fetch(`/api/access/list?clanTag=${encodeURIComponent(clanTag)}&accessPassword=${managerPassword}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          memberIdToRemove: memberId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Access revoked successfully');
        loadAccessMembers();
      } else {
        alert(`Error revoking access: ${data.error}`);
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Failed to revoke access');
    }
  };

  const togglePasswordVisibility = (memberId: string) => {
    setAccessMembers(prev => prev.map(member => 
      member.id === memberId 
        ? { ...member, showPassword: !member.showPassword }
        : member
    ));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading access members...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Access Management</h2>
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
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Access Member'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New Access Member</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Member's name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CoC Player Tag
                </label>
                <input
                  type="text"
                  value={newMember.cocPlayerTag}
                  onChange={(e) => setNewMember(prev => ({ ...prev, cocPlayerTag: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#ABC123XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="member@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Level
                </label>
                <select
                  value={newMember.accessLevel}
                  onChange={(e) => setNewMember(prev => ({ ...prev, accessLevel: e.target.value as AccessLevel }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer - Read only</option>
                  <option value="member">Member - Basic access</option>
                  <option value="elder">Elder - Change management</option>
                  <option value="coleader">Co-Leader - Most features</option>
                  <option value="leader">Leader - Full access</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={newMember.notes}
                onChange={(e) => setNewMember(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Optional notes about this member..."
              />
            </div>
            <div className="mt-4">
              <button
                onClick={addAccessMember}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Grant Access
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Access Level</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Password</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Accessed</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accessMembers.map((member) => (
                <tr key={member.id} className={!member.isActive ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      {member.cocPlayerTag && (
                        <div className="text-sm text-gray-500">{member.cocPlayerTag}</div>
                      )}
                      {member.notes && (
                        <div className="text-xs text-gray-400">{member.notes}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      member.accessLevel === 'leader' ? 'bg-purple-100 text-purple-800' :
                      member.accessLevel === 'coleader' ? 'bg-blue-100 text-blue-800' :
                      member.accessLevel === 'elder' ? 'bg-green-100 text-green-800' :
                      member.accessLevel === 'member' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {getAccessLevelDisplayName(member.accessLevel)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {member.showPassword ? member.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(member.id)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        {member.showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {member.lastAccessed
                      ? safeLocaleDateString(member.lastAccessed, {
                          fallback: 'Unknown',
                          context: 'AccessManager member.lastAccessed'
                        })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    {member.isActive ? (
                      <button
                        onClick={() => revokeAccess(member.id, member.name)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Revoke Access
                      </button>
                    ) : (
                      <span className="text-red-600 text-sm font-medium">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Share the individual passwords with clan members</li>
            <li>Members use their password to access the dashboard</li>
            <li>Revoke access instantly when someone leaves</li>
            <li>Each member gets their own unique access level</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
