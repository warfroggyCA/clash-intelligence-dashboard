"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, UserPlus, UserCheck, Clock, MessageSquare, X, AlertCircle } from "lucide-react";
import { safeLocaleDateString } from '@/lib/date';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import type { JoinerNotifications, JoinerNotification } from '@/types';

interface JoinerManagerProps {
  clanTag: string;
  onClose: () => void;
  onNotificationChange?: (updatedData: JoinerNotifications) => void;
  onDismissAll?: () => void;
  cachedNotifications?: JoinerNotifications | null;
}

export default function JoinerManager({ clanTag, onClose, onNotificationChange, onDismissAll, cachedNotifications }: JoinerManagerProps) {
  const [notifications, setNotifications] = useState<JoinerNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { dismissAllJoinerNotifications, setJoinerNotifications } = useDashboardStore();

  const loadNotifications = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/joiners/notifications?clanTag=${encodeURIComponent(clanTag)}&days=7`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setNotifications(data.data);
        onNotificationChange?.(data.data);
      }
    } catch (error) {
      console.error('Failed to load joiner notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clanTag, onNotificationChange]);

  useEffect(() => {
    if (cachedNotifications) {
      setNotifications(cachedNotifications);
      setLoading(false);
      return;
    }

    void loadNotifications();
  }, [cachedNotifications, loadNotifications]);

  const markReviewed = async (id: string) => {
    try {
      const response = await fetch('/api/joiners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'reviewed' }),
      });

      if (response.ok) {
        // Optimistic update - remove from local state
        if (notifications) {
          const updated = {
            critical: notifications.critical.filter(n => n.id !== id),
            high: notifications.high.filter(n => n.id !== id),
            medium: notifications.medium.filter(n => n.id !== id),
            low: notifications.low.filter(n => n.id !== id),
            totalCount: notifications.totalCount - 1,
            hasNotifications: notifications.totalCount - 1 > 0,
          };
          setNotifications(updated);
          setJoinerNotifications(updated.totalCount);
          onNotificationChange?.(updated);
        }
      } else {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark joiner as reviewed:', error);
      await loadNotifications();
    }
  };

  const handleDismissAll = () => {
    dismissAllJoinerNotifications();
    setNotifications({
      critical: [],
      high: [],
      medium: [],
      low: [],
      totalCount: 0,
      hasNotifications: false,
    });
    setJoinerNotifications(0);
    onDismissAll?.();
  };

  const renderNotification = (notification: JoinerNotification, priority: 'critical' | 'high' | 'medium' | 'low') => {
    const { metadata, warnings, notes, history } = notification;
    const joinDate = new Date(notification.detectedAt);
    const isCritical = priority === 'critical';
    const isHigh = priority === 'high';
    
    return (
      <div
        key={notification.id}
        className={`border rounded-lg p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${
          isCritical
            ? 'border-red-500 bg-red-50 hover:border-red-600'
            : isHigh
              ? 'border-orange-300 bg-orange-50 hover:border-orange-400'
              : priority === 'medium'
                ? 'border-blue-200 bg-blue-50 hover:border-blue-300'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-lg">
                {notification.playerName || notification.playerTag}
              </h4>
              {isCritical && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  ⚠️ WARNINGS
                </span>
              )}
              {isHigh && metadata.hasNameChange && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  📝 Name Changed
                </span>
              )}
              {metadata.hasPreviousHistory && (
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                  🔄 Returning Player
                </span>
              )}
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Joined: {safeLocaleDateString(joinDate)}</span>
              </div>
              
              {metadata.hasPreviousHistory && (
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span>
                    Previous tenure: {metadata.totalTenure} days
                    {metadata.lastDepartureDate && ` • Last departed: ${safeLocaleDateString(new Date(metadata.lastDepartureDate))}`}
                  </span>
                </div>
              )}
              
              {metadata.hasNameChange && metadata.previousName && (
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    <strong>Name changed:</strong> Was "{metadata.previousName}", now "{notification.playerName}"
                  </span>
                </div>
              )}
            </div>

            {/* Warnings Section - CRITICAL */}
            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border-2 border-red-500 bg-red-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h5 className="font-bold text-red-900">
                    {warnings.length} Active Warning{warnings.length > 1 ? 's' : ''}
                  </h5>
                </div>
                <div className="space-y-2">
                  {warnings.map((warning: any, idx: number) => (
                    <div key={idx} className="text-sm text-red-800">
                      <div className="font-semibold">{warning.warning_note}</div>
                      {warning.created_at && (
                        <div className="text-xs text-red-600">
                          {safeLocaleDateString(new Date(warning.created_at))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {notes.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-300 bg-blue-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <h5 className="font-semibold text-blue-900">
                    {notes.length} Note{notes.length > 1 ? 's' : ''}
                  </h5>
                </div>
                <div className="space-y-2">
                  {notes.slice(0, 3).map((note: any, idx: number) => (
                    <div key={idx} className="text-sm text-blue-800">
                      <div>{note.note}</div>
                      {note.created_at && (
                        <div className="text-xs text-blue-600">
                          {safeLocaleDateString(new Date(note.created_at))}
                        </div>
                      )}
                    </div>
                  ))}
                  {notes.length > 3 && (
                    <div className="text-xs text-blue-600">
                      +{notes.length - 3} more note{notes.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="ml-4 flex flex-col gap-2">
            <button
              onClick={() => markReviewed(notification.id)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Mark Reviewed
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">Loading joiner notifications...</div>
        </div>
      </div>
    );
  }

  const totalCount = notifications?.totalCount || 0;
  const criticalCount = notifications?.critical.length || 0;
  const highCount = notifications?.high.length || 0;
  const mediumCount = notifications?.medium.length || 0;
  const lowCount = notifications?.low.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-red-600 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <UserPlus className="w-6 h-6" />
                New Joiner Notifications
              </h2>
              <p className="text-sm text-red-100 mt-1">
                {criticalCount > 0 && (
                  <span className="font-bold">⚠️ {criticalCount} with WARNINGS</span>
                )}
                {criticalCount > 0 && (highCount > 0 || mediumCount > 0 || lowCount > 0) && ' • '}
                {highCount > 0 && `${highCount} high priority`}
                {highCount > 0 && (mediumCount > 0 || lowCount > 0) && ' • '}
                {mediumCount > 0 && `${mediumCount} returning`}
                {mediumCount > 0 && lowCount > 0 && ' • '}
                {lowCount > 0 && `${lowCount} new`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {totalCount === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <UserCheck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No pending joiner notifications.</p>
            </div>
          ) : (
            <>
              {/* CRITICAL: Warnings */}
              {notifications?.critical.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    CRITICAL: Players with Warnings ({notifications.critical.length})
                  </h3>
                  <div className="space-y-4">
                    {notifications.critical.map((n) => renderNotification(n, 'critical'))}
                  </div>
                </div>
              )}

              {/* HIGH: Notes or Name Change */}
              {notifications?.high.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    High Priority: Notes or Name Changes ({notifications.high.length})
                  </h3>
                  <div className="space-y-4">
                    {notifications.high.map((n) => renderNotification(n, 'high'))}
                  </div>
                </div>
              )}

              {/* MEDIUM: Previous History */}
              {notifications?.medium.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Returning Players ({notifications.medium.length})
                  </h3>
                  <div className="space-y-4">
                    {notifications.medium.map((n) => renderNotification(n, 'medium'))}
                  </div>
                </div>
              )}

              {/* LOW: New Players */}
              {notifications?.low.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    New Players ({notifications.low.length})
                  </h3>
                  <div className="space-y-4">
                    {notifications.low.map((n) => renderNotification(n, 'low'))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total: {totalCount} notification{totalCount !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadNotifications()}
              disabled={refreshing}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {totalCount > 0 && (
              <button
                onClick={handleDismissAll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Dismiss All
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

