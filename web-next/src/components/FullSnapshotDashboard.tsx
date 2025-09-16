"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, Users, TrendingUp, Shield, Trophy, Calendar, Sword, Castle } from "lucide-react";
import type { FullClanSnapshot } from "@/lib/full-snapshot";

type Props = {
  clanTag: string;
  onNotificationChange?: () => void;
};

export default function FullSnapshotDashboard({ clanTag, onNotificationChange }: Props) {
  const [snapshot, setSnapshot] = useState<FullClanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadLatestSnapshot();
    loadAvailableDates();
  }, [clanTag]);

  const loadLatestSnapshot = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/full-snapshots?clanTag=${encodeURIComponent(clanTag)}&latest=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSnapshot(data.data);
        setSelectedDate(data.data.fetchedAt.slice(0, 10)); // Set current date as selected
      } else {
        setError(data.error || "Failed to load snapshot");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load snapshot");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDates = async () => {
    try {
      const response = await fetch(`/api/full-snapshots?clanTag=${encodeURIComponent(clanTag)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableDates(data.data.dates);
        }
      }
    } catch (err) {
      console.error('Failed to load available dates:', err);
    }
  };

  const loadSnapshotByDate = async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/full-snapshots?clanTag=${encodeURIComponent(clanTag)}&date=${date}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSnapshot(data.data);
        setSelectedDate(date);
      } else {
        setError(data.error || "Failed to load snapshot");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load snapshot");
    } finally {
      setLoading(false);
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

  const getWarStatus = () => {
    if (!snapshot?.currentWar) return { status: 'No War', color: 'gray' };
    
    const war = snapshot.currentWar;
    if (war.state === 'inWar') {
      return { status: 'In War', color: 'red' };
    } else if (war.state === 'preparation') {
      return { status: 'Preparation', color: 'yellow' };
    } else if (war.state === 'warEnded') {
      return { status: 'War Ended', color: 'green' };
    }
    return { status: 'Unknown', color: 'gray' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading snapshot data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadLatestSnapshot}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600">No snapshot data found for this clan.</p>
        </div>
      </div>
    );
  }

  const warStatus = getWarStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {snapshot.clan?.name || 'Clan Dashboard'}
              </h1>
              <p className="text-gray-600">#{snapshot.clanTag}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="font-medium">{formatDate(snapshot.fetchedAt)}</p>
            </div>
          </div>

          {/* Date Selector */}
          {availableDates.length > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <Calendar className="h-5 w-5 text-gray-500" />
              <select
                value={selectedDate || ''}
                onChange={(e) => e.target.value && loadSnapshotByDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a date...</option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date ? new Date(date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'Unknown Date'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Members</p>
                <p className="text-2xl font-bold text-gray-900">{snapshot.memberSummaries.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Trophies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {snapshot.memberSummaries.reduce((sum, m) => sum + (m.trophies || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <Sword className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">War Status</p>
                <p className={`text-lg font-bold ${warStatus.color === 'red' ? 'text-red-600' : warStatus.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {warStatus.status}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <Castle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Capital Raids</p>
                <p className="text-2xl font-bold text-gray-900">{snapshot.metadata.capitalSeasons}</p>
              </div>
            </div>
          </div>
        </div>

        {/* War Information */}
        {snapshot.currentWar && (
          <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Sword className="h-6 w-6 text-red-600 mr-2" />
              Current War
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Opponent</p>
                <p className="text-lg font-semibold text-gray-900">
                  {snapshot.currentWar.opponent?.name || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">War Size</p>
                <p className="text-lg font-semibold text-gray-900">
                  {snapshot.currentWar.teamSize || 'Unknown'}v{snapshot.currentWar.teamSize || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">State</p>
                <p className={`text-lg font-semibold ${warStatus.color === 'red' ? 'text-red-600' : warStatus.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {warStatus.status}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent War Log */}
        {snapshot.warLog && snapshot.warLog.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-6 w-6 text-blue-600 mr-2" />
              Recent Wars
            </h2>
            <div className="space-y-3">
              {snapshot.warLog.slice(0, 5).map((war, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      vs {war.opponent?.name || 'Unknown Clan'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {war.teamSize || 'Unknown'}v{war.teamSize || 'Unknown'} • {war.result || 'Unknown Result'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {war.endTime ? new Date(war.endTime).toLocaleDateString() : 'Unknown Date'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Member Summary */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Users className="h-6 w-6 text-indigo-600 mr-2" />
            Member Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TH Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trophies</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Donations</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {snapshot.memberSummaries.slice(0, 20).map((member, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {member.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.role || 'Member'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.townHallLevel || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.trophies?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.donations?.toLocaleString() || '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshot.memberSummaries.length > 20 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                Showing 20 of {snapshot.memberSummaries.length} members
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
