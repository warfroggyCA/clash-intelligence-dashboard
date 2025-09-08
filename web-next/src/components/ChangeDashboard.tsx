"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, Users, TrendingUp, Shield, Trophy } from "lucide-react";

type ChangeSummary = {
  date: string;
  clanTag: string;
  changes: Array<{
    type: string;
    member: any;
    description: string;
    previousValue?: any;
    newValue?: any;
  }>;
  summary: string;
  unread: boolean;
  actioned: boolean;
  createdAt: string;
};

export default function ChangeDashboard({ clanTag }: { clanTag: string }) {
  const [changes, setChanges] = useState<ChangeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChanges();
  }, [clanTag]);

  const loadChanges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/snapshots/changes?clanTag=${encodeURIComponent(clanTag)}`);
      const data = await response.json();
      
      if (data.success) {
        setChanges(data.changes || []);
      } else {
        setError(data.error || "Failed to load changes");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (date: string) => {
    try {
      const response = await fetch('/api/snapshots/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag, date, action: 'read' }),
      });
      
      if (response.ok) {
        setChanges(prev => prev.map(c => 
          c.date === date ? { ...c, unread: false } : c
        ));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAsActioned = async (date: string) => {
    try {
      const response = await fetch('/api/snapshots/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag, date, action: 'actioned' }),
      });
      
      if (response.ok) {
        setChanges(prev => prev.map(c => 
          c.date === date ? { ...c, actioned: true, unread: false } : c
        ));
      }
    } catch (err) {
      console.error('Failed to mark as actioned:', err);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'new_member': return <Users className="w-4 h-4 text-green-500" />;
      case 'left_member': return <Users className="w-4 h-4 text-red-500" />;
      case 'hero_upgrade': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'town_hall_upgrade': return <TrendingUp className="w-4 h-4 text-purple-500" />;
      case 'trophy_change': return <Trophy className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'new_member': return 'New Member';
      case 'left_member': return 'Member Left';
      case 'hero_upgrade': return 'Hero Upgrade';
      case 'town_hall_upgrade': return 'Town Hall Upgrade';
      case 'trophy_change': return 'Trophy Change';
      case 'donation_change': return 'Donation Activity';
      case 'role_change': return 'Role Change';
      default: return 'Change';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">Error: {error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No change summaries available yet.</p>
          <p className="text-sm mt-2">Daily snapshots will appear here after the first automated collection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Clan Activity Dashboard</h2>
        <p className="text-gray-600">Daily summaries of clan changes and activity</p>
      </div>

      <div className="space-y-4">
        {changes.map((changeSummary) => (
          <div
            key={changeSummary.date}
            className={`border rounded-lg p-4 ${
              changeSummary.unread 
                ? 'border-blue-200 bg-blue-50' 
                : changeSummary.actioned 
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">
                  {new Date(changeSummary.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                {changeSummary.unread && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    New
                  </span>
                )}
                {changeSummary.actioned && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
              
              {changeSummary.unread && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => markAsRead(changeSummary.date)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark Read
                  </button>
                  <button
                    onClick={() => markAsActioned(changeSummary.date)}
                    className="text-sm text-green-600 hover:text-green-800 font-medium"
                  >
                    Mark Actioned
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3">
              <p className="text-gray-700">{changeSummary.summary}</p>
            </div>

            {changeSummary.changes.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Detailed Changes ({changeSummary.changes.length})
                </h4>
                <div className="space-y-2">
                  {changeSummary.changes.map((change, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      {getChangeIcon(change.type)}
                      <span className="text-gray-600">{change.description}</span>
                      {change.previousValue !== undefined && change.newValue !== undefined && (
                        <span className="text-gray-400">
                          ({change.previousValue} → {change.newValue})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
