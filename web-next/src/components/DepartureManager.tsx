"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, UserX, UserCheck, Clock, MessageSquare, X } from "lucide-react";
import { safeLocaleDateString } from '@/lib/date';

interface DepartureRecord {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason?: string;
  notes?: string;
  addedBy?: string;
  lastSeen?: string;
  lastRole?: string;
  lastTownHall?: number;
  lastTrophies?: number;
}

interface RejoinNotification {
  memberTag: string;
  memberName: string;
  previousDeparture: DepartureRecord;
  rejoinDate: string;
  daysAway: number;
}

interface DepartureNotifications {
  rejoins: RejoinNotification[];
  activeDepartures: DepartureRecord[];
  hasNotifications: boolean;
}

interface DepartureManagerProps {
  clanTag: string;
  onClose: () => void;
  onNotificationChange?: (updatedData: DepartureNotifications) => void;
  onDismissAll?: () => void;
  cachedNotifications?: DepartureNotifications | null;
}

export default function DepartureManager({ clanTag, onClose, onNotificationChange, onDismissAll, cachedNotifications }: DepartureManagerProps) {
  const [notifications, setNotifications] = useState<DepartureNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingDeparture, setEditingDeparture] = useState<DepartureRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/departures/notifications?clanTag=${encodeURIComponent(clanTag)}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to load departure notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clanTag]);

  useEffect(() => {
    // Use cached data immediately for instant loading
    if (cachedNotifications) {
      setNotifications(cachedNotifications);
      setLoading(false);
    } else {
      // Only load if no cached data is available
      loadNotifications();
    }
  }, [cachedNotifications, loadNotifications]);

  const updateDeparture = async (departure: DepartureRecord) => {
    try {
      const response = await fetch('/api/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          action: 'add',
          departure: {
            ...departure,
            notes,
            departureReason: reason,
            addedBy: 'User' // You could get this from auth context
          }
        })
      });

      if (response.ok) {
        // Optimistic update - update local state immediately
        if (notifications) {
          const updatedDepartures = notifications.activeDepartures.map(d => 
            d.memberTag === departure.memberTag 
              ? { ...d, notes, departureReason: reason }
              : d
          );
          
          const updatedNotifications = {
            ...notifications,
            activeDepartures: updatedDepartures
          };
          
          setNotifications(updatedNotifications);
          
          // Notify parent component that notifications have changed
          onNotificationChange?.(updatedNotifications);
        }
        
        // Close the edit form
        setEditingDeparture(null);
        setNotes("");
        setReason("");
        
        // No need to reload - we've updated the state optimistically
      }
    } catch (error) {
      console.error('Failed to update departure:', error);
      // If there's an error, we could reload to get the correct state
      await loadNotifications();
    }
  };

  const markRejoinResolved = async (memberTag: string) => {
    try {
      const response = await fetch('/api/departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          action: 'resolve',
          departure: { memberTag }
        })
      });

      if (response.ok) {
        // Optimistic update - remove the resolved rejoin from local state
        if (notifications) {
          const updatedRejoins = notifications.rejoins.filter(r => r.memberTag !== memberTag);
          
          const updatedNotifications = {
            ...notifications,
            rejoins: updatedRejoins,
            hasNotifications: updatedRejoins.length > 0 || notifications.activeDepartures.length > 0
          };
          
          setNotifications(updatedNotifications);
          
          // Notify parent component that notifications have changed
          onNotificationChange?.(updatedNotifications);
        }
      }
    } catch (error) {
      console.error('Failed to mark rejoin as resolved:', error);
      // If there's an error, reload to get the correct state
      await loadNotifications();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!notifications || !notifications.hasNotifications) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Member Departures</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-gray-500">
            <UserCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No departure notifications at this time.</p>
            <p className="text-sm mt-2">All members are accounted for!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            Member Departures & Rejoins
            {refreshing && (
              <span className="ml-2 text-sm text-gray-500 animate-pulse">🔄 Refreshing...</span>
            )}
          </h2>
          <div className="flex items-center space-x-3">
            {/* Debug info */}
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Rejoins: {notifications?.rejoins.length || 0} | Departures: {notifications?.activeDepartures.length || 0} total ({notifications?.activeDepartures.filter(d => d.notes || d.departureReason).length || 0} processed, {notifications?.activeDepartures.filter(d => !d.notes && !d.departureReason).length || 0} pending)
            </div>
            <button
              onClick={loadNotifications}
              disabled={refreshing}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium hover:scale-105 transition-all duration-200"
            >
              {refreshing ? '🔄' : '🔄'} Refresh
            </button>
            <button
              onClick={() => {
                onDismissAll?.();
                onClose();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium hover:scale-105 transition-all duration-200"
            >
              ✅ Done
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:scale-110 transition-all duration-200 p-1 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Rejoins Section */}
        {notifications.rejoins.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <UserCheck className="w-5 h-5 text-green-500 mr-2" />
              Members Who Returned ({notifications.rejoins.length})
            </h3>
            <div className="space-y-4">
              {notifications.rejoins.map((rejoin) => (
                <div key={rejoin.memberTag} className="border border-green-200 bg-green-50 rounded-lg p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:border-green-300 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800">{rejoin.memberName}</h4>
                      <p className="text-sm text-green-600">
                        Returned after {rejoin.daysAway} days away
                      </p>
                      <div className="mt-2 text-sm text-gray-600">
                        <p><strong>Previous departure:</strong> {safeLocaleDateString(rejoin.previousDeparture.departureDate, {
                          context: 'DepartureManager previousDeparture',
                          fallback: 'Unknown Date'
                        })}</p>
                        {rejoin.previousDeparture.lastRole && (
                          <p><strong>Last role:</strong> {rejoin.previousDeparture.lastRole}</p>
                        )}
                        {rejoin.previousDeparture.lastTownHall && (
                          <p><strong>Last TH:</strong> {rejoin.previousDeparture.lastTownHall}</p>
                        )}
                        {rejoin.previousDeparture.notes && (
                          <p><strong>Notes:</strong> {rejoin.previousDeparture.notes}</p>
                        )}
                        {rejoin.previousDeparture.departureReason && (
                          <p><strong>Reason:</strong> {rejoin.previousDeparture.departureReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 ml-4 items-stretch sm:items-center">
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/tenure/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                clanTag,
                                memberTag: rejoin.memberTag,
                                mode: 'grant-existing'
                              })
                            });
                          } catch (e) { console.error(e); }
                          await markRejoinResolved(rejoin.memberTag);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 hover:scale-105 transition-all duration-200 font-medium"
                        title="Grant prior tenure and resume counting from today"
                      >
                        Grant Tenure
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/tenure/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                clanTag,
                                memberTag: rejoin.memberTag,
                                mode: 'reset'
                              })
                            });
                          } catch (e) { console.error(e); }
                          await markRejoinResolved(rejoin.memberTag);
                        }}
                        className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 hover:scale-105 transition-all duration-200 font-medium"
                        title="Reset tenure to 0 starting today"
                      >
                        Reset Tenure
                      </button>
                      <button
                        onClick={() => markRejoinResolved(rejoin.memberTag)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 hover:scale-105 transition-all duration-200 font-medium"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Departures Section */}
        {notifications.activeDepartures.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <UserX className="w-5 h-5 text-red-500 mr-2" />
              Recent Departures ({notifications.activeDepartures.length})
            </h3>
            <div className="space-y-4">
              {notifications.activeDepartures.map((departure) => {
                const isProcessed = departure.notes || departure.departureReason;
                return (
                <div key={departure.memberTag} className={`border rounded-lg p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
                  isProcessed 
                    ? 'border-green-200 bg-green-50 hover:border-green-300' 
                    : 'border-red-200 bg-red-50 hover:border-red-300'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className={`font-semibold ${isProcessed ? 'text-green-800' : 'text-red-800'}`}>
                        {departure.memberName}
                        {isProcessed && <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">✓ Processed</span>}
                      </h4>
                      <p className={`text-sm ${isProcessed ? 'text-green-600' : 'text-red-600'}`}>
                        Left on {safeLocaleDateString(departure.departureDate, {
                          context: 'DepartureManager departureDate',
                          fallback: 'Unknown Date'
                        })}
                      </p>
                      <div className="mt-2 text-sm text-gray-600">
                        {departure.lastRole && <p><strong>Last role:</strong> {departure.lastRole}</p>}
                        {departure.lastTownHall && <p><strong>Last TH:</strong> {departure.lastTownHall}</p>}
                        {departure.lastTrophies && <p><strong>Last trophies:</strong> {departure.lastTrophies}</p>}
                        {departure.notes && <p><strong>Notes:</strong> {departure.notes}</p>}
                        {departure.departureReason && <p><strong>Reason:</strong> {departure.departureReason}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingDeparture(departure);
                        setNotes(departure.notes || "");
                        setReason(departure.departureReason || "");
                      }}
                      className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 hover:scale-105 transition-all duration-200 font-medium"
                    >
                      {isProcessed ? 'Edit Notes' : 'Add Notes'}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit Departure Modal */}
        {editingDeparture && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Add Notes for {editingDeparture.memberName}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departure Reason
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Personal reasons">Personal reasons</option>
                    <option value="Found another clan">Found another clan</option>
                    <option value="Taking a break">Taking a break</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Kicked">Kicked</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes about this departure..."
                    className="w-full border rounded-lg px-3 py-2 h-24"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setEditingDeparture(null);
                    setNotes("");
                    setReason("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:scale-105 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateDeparture(editingDeparture)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 font-medium"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
