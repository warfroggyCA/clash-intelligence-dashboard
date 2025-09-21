import React, { useState, useEffect } from 'react';
import { safeLocaleDateString } from '@/lib/date';
import { AccessMember, AccessLevel, getAccessLevelDisplayName } from '../lib/access-management';

interface AccessManagerProps {
  clanTag: string;
  clanName: string;
  onClose: () => void;
}

interface AccessMemberWithPassword extends AccessMember {
  showPassword?: boolean;
  password?: string;
}

export default function AccessManager({ clanTag, clanName, onClose }: AccessManagerProps) {
  const [accessMembers, setAccessMembers] = useState<AccessMemberWithPassword[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    cocPlayerTag: '',
    email: '',
    accessLevel: 'member' as AccessLevel,
    notes: ''
  });

  useEffect(() => {
    if (isUnlocked && managerPassword) {
      loadAccessMembers(managerPassword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clanTag, isUnlocked]);

  // Check if access configuration exists when component mounts
  useEffect(() => {
    const checkAccessConfig = async () => {
      try {
        const response = await fetch(`/api/access/init?clanTag=${encodeURIComponent(clanTag)}`);
        const payload = await response.json();
        if (!payload.success && payload.error === "No access configuration found for this clan") {
          // No configuration exists, show setup option
          setNeedsSetup(true);
        }
      } catch (error) {
        console.error('Error checking access configuration:', error);
      }
    };
    
    checkAccessConfig();
  }, [clanTag]);

  const loadAccessMembers = async (password: string): Promise<boolean> => {
    const trimmed = password.trim();
    if (!trimmed) {
      alert('Enter your management password to view access members.');
      return false;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/access/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', accessPassword: trimmed, clanTag })
      });
      const payload = await response.json();
      if (payload.success) {
        const members = (payload.data?.accessMembers || []) as AccessMember[];
        setAccessMembers(members.map((member) => ({ ...member, showPassword: false })));
        return true;
      }
      alert(`Error loading access members: ${payload.error}`);
      return false;
    } catch (error) {
      console.error('Error loading access members:', error);
      alert('Failed to load access members');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    const success = await loadAccessMembers(managerPassword);
    if (success) {
      setManagerPassword(managerPassword.trim());
      setIsUnlocked(true);
    }
  };

  const addAccessMember = async () => {
    if (!newMember.name.trim()) {
      alert('Name is required');
      return;
    }
    const trimmedPassword = managerPassword.trim();
    if (!trimmedPassword) {
      alert('Management password required to add members.');
      return;
    }

    try {
      const response = await fetch(`/api/access/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          accessPassword: trimmedPassword,
          clanTag,
          ...newMember
        })
      });

      const payload = await response.json();
      if (payload.success) {
        const newPassword: string | undefined = payload.data?.newPassword;
        if (newPassword) {
          alert(`Access granted! Share this password with ${newMember.name}: ${newPassword}`);
        }
        setNewMember({ name: '', cocPlayerTag: '', email: '', accessLevel: 'member', notes: '' });
        setShowAddForm(false);
        await loadAccessMembers(trimmedPassword);
      } else {
        alert(`Error adding member: ${payload.error}`);
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
    const trimmedPassword = managerPassword.trim();
    if (!trimmedPassword) {
      alert('Management password required to revoke access.');
      return;
    }
    try {
      const response = await fetch(`/api/access/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          accessPassword: trimmedPassword,
          clanTag,
          memberIdToRemove: memberId
        })
      });
      const payload = await response.json();
      if (payload.success) {
        alert('Access revoked successfully');
        await loadAccessMembers(trimmedPassword);
      } else {
        alert(`Error revoking access: ${payload.error}`);
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Failed to revoke access');
    }
  };

  const togglePasswordVisibility = (memberId: string) => {
    setAccessMembers((prev) => prev.map((member) => {
      if (member.id !== memberId) return member;
      if (!member.password) {
        alert('Passwords are only shown at creation time. Generate a new password if the member needs access again.');
        return member;
      }
      return { ...member, showPassword: !member.showPassword };
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Access Management</h2>
            <p className="text-gray-600">{clanName} ({clanTag})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Management Password</h3>
          <p className="text-sm text-gray-600 mb-3">
            Enter your leadership password to view and manage clan access. Passwords are never stored locally.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter management password"
              autoComplete="off"
            />
            <button
              onClick={handleUnlock}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300"
              disabled={!managerPassword.trim() || loading}
            >
              {isUnlocked ? 'Refresh' : 'Unlock'}
            </button>
          </div>
        </div>

        {needsSetup ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Access Control Not Set Up</h3>
            <p className="text-blue-700 mb-4">
              This clan doesn&apos;t have access control configured yet. Set up access management to control who can view and manage clan data.
            </p>
            <button
              onClick={() => {
                // Close this modal and open the setup modal
                onClose();
                // We need to trigger the setup modal from the parent
                // For now, we'll show an alert with instructions
                alert('Access setup functionality will be implemented. For now, you can use the API directly to create an access configuration.');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Set Up Access Control
            </button>
          </div>
        ) : !isUnlocked ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            Unlock the access manager above to review members and manage permissions.
          </div>
        ) : (
          <>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newMember.name}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Member's name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CoC Player Tag</label>
                    <input
                      type="text"
                      value={newMember.cocPlayerTag}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, cocPlayerTag: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#ABC123XYZ"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="member@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
                    <select
                      value={newMember.accessLevel}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, accessLevel: e.target.value as AccessLevel }))}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={newMember.notes}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Optional notes about this member..."
                  />
                </div>
                <div className="mt-4">
                  <button onClick={addAccessMember} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Grant Access
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-sm text-gray-600">Loading members...</span>
              </div>
            ) : (
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
                            {member.cocPlayerTag && <div className="text-sm text-gray-500">{member.cocPlayerTag}</div>}
                            {member.notes && <div className="text-xs text-gray-400">{member.notes}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              member.accessLevel === 'leader'
                                ? 'bg-purple-100 text-purple-800'
                                : member.accessLevel === 'coleader'
                                  ? 'bg-blue-100 text-blue-800'
                                  : member.accessLevel === 'elder'
                                    ? 'bg-green-100 text-green-800'
                                    : member.accessLevel === 'member'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {getAccessLevelDisplayName(member.accessLevel)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {member.password
                                ? member.showPassword
                                  ? member.password
                                  : '••••••••'
                                : 'Not stored'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(member.id)}
                              className={`text-sm ${member.password ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
                              disabled={!member.password}
                            >
                              {member.password ? (member.showPassword ? '👁️' : '👁️‍🗨️') : '🚫'}
                            </button>
                          </div>
                          <div className="text-xs text-gray-400">
                            {member.password
                              ? 'Passwords are shown once. Share them immediately with the member.'
                              : 'Password hidden — generate a new one if needed.'}
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
            )}

            <div className="mt-6 text-sm text-gray-500">
              <p><strong>Instructions:</strong></p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Share individual passwords with clan members</li>
                <li>Members use their password to access the dashboard</li>
                <li>Revoke access immediately when someone leaves the clan</li>
              </ul>
            </div>
          </>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
