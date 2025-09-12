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
  gameChatMessages?: string[];
  unread: boolean;
  actioned: boolean;
  createdAt: string;
};

export default function ChangeDashboard({ 
  clanTag, 
  onNotificationChange,
  onGenerateAISummary
}: { 
  clanTag: string;
  onNotificationChange?: () => void;
  onGenerateAISummary?: () => void;
}) {
  const [changes, setChanges] = useState<ChangeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [clearedMessages, setClearedMessages] = useState<Set<string>>(new Set());
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  useEffect(() => {
    loadChanges();
  }, [clanTag]);

  // Load cleared messages from localStorage
  useEffect(() => {
    const loadClearedMessages = () => {
      try {
        const clearedKey = `cleared_messages_${clanTag.replace('#', '').toUpperCase()}`;
        const saved = localStorage.getItem(clearedKey);
        if (saved) {
          setClearedMessages(new Set(JSON.parse(saved)));
        }
      } catch (error) {
        console.error('Failed to load cleared messages:', error);
      }
    };
    
    if (clanTag) {
      loadClearedMessages();
    }
  }, [clanTag]);

  const handleGenerateAISummary = async () => {
    if (!onGenerateAISummary) return;
    
    setAiSummaryLoading(true);
    try {
      await onGenerateAISummary();
      // Refresh the activity data after generating AI summary
      await loadChanges();
    } finally {
      // Keep loading state for a bit to show completion
      setTimeout(() => setAiSummaryLoading(false), 1000);
    }
  };

  const loadChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load AI summaries from localStorage first
      let aiSummaries: ChangeSummary[] = [];
      try {
        const savedSummaries = localStorage.getItem('ai_summaries');
        if (savedSummaries) {
          aiSummaries = JSON.parse(savedSummaries).filter((summary: ChangeSummary) => 
            summary.clanTag === clanTag
          );
        }
      } catch (error) {
        console.warn('Failed to load AI summaries from localStorage:', error);
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/snapshots/changes?clanTag=${encodeURIComponent(clanTag)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Combine server changes with AI summaries
        const serverChanges = data.changes || [];
        const allChanges = [...aiSummaries, ...serverChanges];
        
        // Sort by date (newest first)
        allChanges.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setChanges(allChanges);
      } else {
        setError(data.error || "Failed to load changes");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else {
        setError(err.message || "Failed to load changes");
      }
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
        onNotificationChange?.(); // Refresh notification count
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
        onNotificationChange?.(); // Refresh notification count
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

  // Limit changes shown initially for better performance
  const getDisplayedChanges = () => {
    if (showAllChanges) return changes;
    return changes.slice(0, 3); // Show only first 3 change summaries initially
  };

  const toggleChangeExpansion = (date: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedChanges(newExpanded);
  };

  const clearMessage = (messageId: string) => {
    const newCleared = new Set(clearedMessages);
    newCleared.add(messageId);
    setClearedMessages(newCleared);
    
    // Save to localStorage
    try {
      const clearedKey = `cleared_messages_${clanTag.replace('#', '').toUpperCase()}`;
      localStorage.setItem(clearedKey, JSON.stringify([...newCleared]));
    } catch (error) {
      console.error('Failed to save cleared messages:', error);
    }
  };

  const copyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy message:', error);
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Clan Activity Dashboard</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadChanges}
              className="rounded-xl px-3 py-2 border shadow-sm transition-colors text-sm bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
              title="Refresh activity data"
            >
              🔄 Refresh
            </button>
            {onGenerateAISummary && (
              <button
                onClick={handleGenerateAISummary}
                disabled={aiSummaryLoading}
                className={`rounded-xl px-3 py-2 border shadow-sm transition-colors text-sm ${
                  aiSummaryLoading 
                    ? 'bg-purple-200 text-purple-500 border-purple-300 cursor-not-allowed' 
                    : 'bg-purple-100 text-purple-700 border-purple-200 hover:shadow hover:bg-purple-200'
                }`}
                title={aiSummaryLoading ? "Generating AI summary..." : "Generate an AI-powered summary of current clan state and changes"}
              >
                {aiSummaryLoading ? (
                  <span className="flex items-center space-x-2">
                    <span className="animate-spin">⏳</span>
                    <span>Generating...</span>
                  </span>
                ) : (
                  "🤖 AI Summary"
                )}
              </button>
            )}
          </div>
        </div>
        <p className="text-gray-600">Daily summaries of clan changes and activity</p>
      </div>

      {/* AI Summary Status Message */}
      {aiSummaryLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="animate-spin">⏳</span>
            <span className="text-blue-700 text-sm">Generating AI summary... This may take a few moments.</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {getDisplayedChanges().map((changeSummary) => (
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

            {changeSummary.gameChatMessages && changeSummary.gameChatMessages.length > 0 && (
              <div className="mb-3 border-t border-gray-200 pt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <span className="mr-2">💬</span>
                  Game Chat Messages
                </h4>
                <div className="space-y-2">
                  {changeSummary.gameChatMessages
                    .map((message, index) => {
                      const messageId = `${changeSummary.date}-${index}`;
                      return { message, index, messageId };
                    })
                    .filter(({ messageId }) => !clearedMessages.has(messageId))
                    .map(({ message, index, messageId }) => (
                    <div key={messageId} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-800 flex-1 min-w-0 break-words max-w-md">
                          {message}
                        </p>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => copyMessage(message)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                            title="Copy to clipboard"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => clearMessage(messageId)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                            title="Remove this message"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {changeSummary.changes.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    Detailed Changes ({changeSummary.changes.length})
                  </h4>
                  {changeSummary.changes.length > 5 && (
                    <button
                      onClick={() => toggleChangeExpansion(changeSummary.date)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {expandedChanges.has(changeSummary.date) ? 'Show Less' : 'Show All'}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {(expandedChanges.has(changeSummary.date) || changeSummary.changes.length <= 5 
                    ? changeSummary.changes 
                    : changeSummary.changes.slice(0, 5)
                  ).map((change, index) => (
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
                  {!expandedChanges.has(changeSummary.date) && changeSummary.changes.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                      ... and {changeSummary.changes.length - 5} more changes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {changes.length > 3 && !showAllChanges && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowAllChanges(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Show All Changes ({changes.length - 3} more)
          </button>
        </div>
      )}

      {showAllChanges && changes.length > 3 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowAllChanges(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Show Less
          </button>
        </div>
      )}
    </div>
  );
}
