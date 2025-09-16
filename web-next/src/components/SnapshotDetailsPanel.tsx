"use client";

import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { format } from 'date-fns';
import { Swords, Castle, Trophy, Shield, Clock, Users } from 'lucide-react';

export default function SnapshotDetailsPanel() {
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);

  if (!snapshotDetails) {
    return null;
  }

  const { currentWar, warLog, capitalRaidSeasons } = snapshotDetails;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Current War Card */}
      {currentWar && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Swords className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Current War</h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`font-medium ${
                currentWar.state === 'inWar' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {currentWar.state}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Team Size</span>
              <span className="font-medium">{currentWar.teamSize}</span>
            </div>
            
            {currentWar.opponent && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-1">Opponent</p>
                <p className="font-medium text-sm">{currentWar.opponent.name}</p>
                <p className="text-xs text-gray-500">{currentWar.opponent.tag}</p>
              </div>
            )}
            
            {currentWar.attacksPerMember && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Attacks per Member</span>
                <span className="font-medium">{currentWar.attacksPerMember}</span>
              </div>
            )}
            
            {currentWar.endTime && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">End Time</span>
                <span className="font-medium text-sm">{format(new Date(currentWar.endTime), 'MMM dd, HH:mm')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* War Log Card */}
      {warLog && warLog.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Trophy className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Wars</h3>
          </div>
          
          <div className="space-y-2">
            {warLog.slice(0, 3).map((war, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    war.result === 'win' 
                      ? 'bg-green-100 text-green-800' 
                      : war.result === 'lose'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {war.result?.toUpperCase() || 'N/A'}
                  </span>
                  <span className="font-medium text-sm">{war.opponent.name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(war.endTime), 'MMM dd')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capital Raid Seasons Card */}
      {capitalRaidSeasons && capitalRaidSeasons.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Castle className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Capital Raids</h3>
          </div>
          
          <div className="space-y-2">
            {capitalRaidSeasons.slice(0, 3).map((season, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">CH {season.capitalHallLevel}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    season.state === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {season.state}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(season.endTime), 'MMM dd')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
