'use client';

import { useState } from 'react';
import { UserCheck, Clock, AlertCircle, Award, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { PlayerHistoryRecord } from '@/lib/player-history';
import { getReturningPlayerStats, formatMovementHistory } from '@/lib/player-history';

interface ReturningPlayerReviewProps {
  returningPlayers: Array<{
    player: PlayerHistoryRecord;
    currentName: string;
    nameChanged: boolean;
  }>;
  onProcessReturn: (
    playerTag: string,
    options: {
      awardPreviousTenure?: number;
      returnNotes?: string;
    }
  ) => void;
  onDismiss: () => void;
}

export const ReturningPlayerReview = ({
  returningPlayers,
  onProcessReturn,
  onDismiss,
}: ReturningPlayerReviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tenureToAward, setTenureToAward] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [archiveMode, setArchiveMode] = useState<'keep-visible' | 'mark-returned'>('mark-returned');

  if (returningPlayers.length === 0) return null;

  const currentReturn = returningPlayers[currentIndex];
  const stats = getReturningPlayerStats(currentReturn.player);
  const history = formatMovementHistory(currentReturn.player.movements);

  const handleProcess = () => {
    onProcessReturn(currentReturn.player.tag, {
      awardPreviousTenure: tenureToAward > 0 ? tenureToAward : undefined,
      returnNotes: returnNotes || undefined,
    });

    // Move to next player or close
    if (currentIndex < returningPlayers.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setTenureToAward(0);
      setReturnNotes('');
    } else {
      onDismiss();
    }
  };

  const handleSkip = () => {
    if (currentIndex < returningPlayers.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setTenureToAward(0);
      setReturnNotes('');
    } else {
      onDismiss();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Returning Player Detected</h2>
              <p className="text-green-100 text-sm">
                {currentIndex + 1} of {returningPlayers.length} returning players
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-white hover:text-green-100 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Player Info */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {currentReturn.currentName}
                </h3>
                <p className="text-sm text-gray-600">{currentReturn.player.tag}</p>
                {currentReturn.nameChanged && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-700">
                      Name changed from: <strong>{currentReturn.player.primaryName}</strong>
                    </span>
                  </div>
                )}
                {currentReturn.player.aliases.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      Known aliases: {currentReturn.player.aliases.map(a => a.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.timesReturned + 1}
                </div>
                <p className="text-xs text-gray-600">
                  {stats.timesReturned === 0 ? '1st' : `${stats.timesReturned + 1}${stats.timesReturned === 1 ? 'nd' : 'rd'}`} return
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Last Departure</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats.lastDepartureDate 
                  ? formatDistanceToNow(new Date(stats.lastDepartureDate), { addSuffix: true })
                  : 'Unknown'
                }
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Departure Reason</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats.lastDepartureReason}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Previous Tenure</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats.lastTenure} days
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Total Tenure</p>
              <p className="text-sm font-semibold text-gray-900">
                {stats.totalTenure} days
              </p>
            </div>
          </div>

          {/* Movement History */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Movement History
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              <ul className="space-y-2 text-sm">
                {history.map((entry, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-700">{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tenure Decision */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Tenure Decision
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Award Previous Tenure? (Optional)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={tenureToAward}
                    onChange={(e) => setTenureToAward(parseInt(e.target.value) || 0)}
                    min="0"
                    max={stats.lastTenure}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-600">
                    days (max: {stats.lastTenure} from last stint)
                  </span>
                  <button
                    onClick={() => setTenureToAward(stats.lastTenure)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Award Full
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Set to 0 to start fresh. This is your discretion based on circumstances.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Return Notes (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Add context about this return (e.g., 'Returned after vacation' or 'Second chance after improvement')"
                />
              </div>
            </div>
          </div>

          {/* Warning for certain departure reasons */}
          {(stats.lastDepartureReason.toLowerCase().includes('kick') || 
            stats.lastDepartureReason.toLowerCase().includes('reject')) && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Review Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    This player was previously {stats.lastDepartureReason.toLowerCase()}. 
                    Consider whether they've addressed the issues before approving their return.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleProcess}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2"
            >
              <UserCheck className="w-5 h-5" />
              Process Return
            </button>
            <button
              onClick={handleSkip}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Skip for Now
            </button>
          </div>

          {returningPlayers.length > 1 && (
            <p className="text-center text-sm text-gray-500">
              {returningPlayers.length - currentIndex - 1} more returning player{returningPlayers.length - currentIndex - 1 !== 1 ? 's' : ''} after this
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReturningPlayerReview;
