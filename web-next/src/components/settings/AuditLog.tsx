"use client";

import { useState, useEffect, useMemo } from 'react';
import { normalizeTag } from '@/lib/tags';
import { cfg } from '@/lib/config';
import { getRoleHeaders } from '@/lib/api/role-header';
import { FileText, Link2, Award, UserX, Shield, Search, Filter } from 'lucide-react';
import type { AuditLogEntry } from '@/app/api/audit-log/route';

interface AuditLogProps {
  clanTag?: string;
}

export default function AuditLog({ clanTag }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const normalizedClanTag = useMemo(() => normalizeTag(clanTag || cfg.homeClanTag) || cfg.homeClanTag, [clanTag]);
  
  useEffect(() => {
    const loadAuditLog = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          clanTag: normalizedClanTag,
          limit: '200',
        });
        
        if (typeFilter !== 'all') {
          params.set('type', typeFilter);
        }
        
        if (userFilter.trim()) {
          params.set('user', userFilter.trim());
        }
        
        const response = await fetch(`/api/audit-log?${params.toString()}`, {
          headers: {
            ...getRoleHeaders(),
          },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Failed to load audit log (${response.status})`);
        }
        
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || 'Failed to load audit log');
        }
        
        setEntries(payload.data?.entries || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    };
    
    void loadAuditLog();
  }, [normalizedClanTag, typeFilter, userFilter]);
  
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    
    const query = searchQuery.toLowerCase();
    return entries.filter(entry => 
      entry.details.toLowerCase().includes(query) ||
      entry.playerTag?.toLowerCase().includes(query) ||
      entry.playerName?.toLowerCase().includes(query) ||
      entry.user?.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);
  
  const getTypeIcon = (type: AuditLogEntry['type']) => {
    switch (type) {
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'alias':
        return <Link2 className="h-4 w-4" />;
      case 'tenure':
        return <Award className="h-4 w-4" />;
      case 'departure':
        return <UserX className="h-4 w-4" />;
      case 'warning':
        return <Shield className="h-4 w-4" />;
      default:
        return null;
    }
  };
  
  const getTypeColor = (type: AuditLogEntry['type']) => {
    switch (type) {
      case 'note':
        return 'text-blue-400';
      case 'alias':
        return 'text-purple-400';
      case 'tenure':
        return 'text-amber-400';
      case 'departure':
        return 'text-red-400';
      case 'warning':
        return 'text-orange-400';
      default:
        return 'text-slate-400';
    }
  };
  
  const getActionColor = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'created':
        return 'text-emerald-400';
      case 'updated':
        return 'text-blue-400';
      case 'deleted':
      case 'archived':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    entries.forEach(entry => {
      if (entry.user) users.add(entry.user);
    });
    return Array.from(users).sort();
  }, [entries]);
  
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6 text-center">
        <p className="text-sm text-slate-400">Loading audit log...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Audit Log</h3>
          <p className="text-sm text-slate-400">Track all changes made by leadership</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-700/70 bg-slate-900/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-700/70 bg-slate-900/80 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          >
            <option value="all">All Types</option>
            <option value="note">Notes</option>
            <option value="alias">Aliases</option>
            <option value="tenure">Tenure</option>
            <option value="departure">Departures</option>
          </select>
          {uniqueUsers.length > 0 && (
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-700/70 bg-slate-900/80 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      {filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-6 text-center">
          <p className="text-sm text-slate-400">No audit log entries found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 border-b border-slate-700/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-2 ${getTypeColor(entry.type)}`}>
                        {getTypeIcon(entry.type)}
                        <span className="capitalize">{entry.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`capitalize ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {entry.user || <span className="text-slate-500 italic" title="Legacy entry created before automatic user tracking">Legacy Entry</span>}
                    </td>
                    <td className="px-4 py-3">
                      {entry.playerTag ? (
                        <div>
                          <div className="text-slate-200 font-mono text-xs">{entry.playerTag}</div>
                          {entry.playerName && (
                            <div className="text-slate-400 text-xs">{entry.playerName}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {entry.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700/50 text-xs text-slate-400 flex-shrink-0">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>
      )}
    </div>
  );
}

