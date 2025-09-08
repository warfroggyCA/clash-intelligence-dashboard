"use client";

import { useState, useEffect } from "react";
import { AlertCircle, UserX, UserCheck, Clock, MessageSquare, X } from "lucide-react";

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
}

export default function DepartureManager({ clanTag, onClose }: DepartureManagerProps) {
  const [notifications, setNotifications] = useState<DepartureNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDeparture, setEditingDeparture] = useState<DepartureRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadNotifications();
  }, [clanTag]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/departures/notifications?clanTag=${encodeURIComponent(clanTag)}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to load departure notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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
        setEditingDeparture(null);
        setNotes("");
        setReason("");
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to update departure:', error);
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
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark rejoin as resolved:', error);
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
          <h2 className="text-2xl font-bold">Member Departures & Rejoins</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
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
                <div key={rejoin.memberTag} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800">{rejoin.memberName}</h4>
                      <p className="text-sm text-green-600">
                        Returned after {rejoin.daysAway} days away
                      </p>
                      <div className="mt-2 text-sm text-gray-600">
                        <p><strong>Previous departure:</strong> {new Date(rejoin.previousDeparture.departureDate).toLocaleDateString()}</p>
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
                    <button
                      onClick={() => markRejoinResolved(rejoin.memberTag)}
                      className="ml-4 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Mark Resolved
                    </button>
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
              {notifications.activeDepartures.map((departure) => (
                <div key={departure.memberTag} className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800">{departure.memberName}</h4>
                      <p className="text-sm text-red-600">
                        Left on {new Date(departure.departureDate).toLocaleDateString()}
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
                      className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Add Notes
                    </button>
                  </div>
                </div>
              ))}
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
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateDeparture(editingDeparture)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
