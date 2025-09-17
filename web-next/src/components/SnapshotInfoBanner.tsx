"use client";

import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, Clock, Users, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SnapshotInfoBanner() {
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const isDataFresh = useDashboardStore(selectors.isDataFresh);
  const dataAge = useDashboardStore(selectors.dataAge);

  if (!snapshotMetadata) {
    return null;
  }

  const getBannerColor = () => {
    if (!dataAge) return 'bg-gray-100 border-gray-300';
    if (dataAge <= 24) return 'bg-green-100 border-green-300';
    if (dataAge <= 48) return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  const getStatusIcon = () => {
    if (!dataAge) return <AlertCircle className="h-5 w-5 text-gray-500" />;
    if (dataAge <= 24) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (dataAge <= 48) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const getStatusText = () => {
    if (!dataAge) return 'Unknown freshness';
    if (dataAge <= 24) return 'Data is fresh';
    if (dataAge <= 48) return 'Data is getting stale';
    return 'Data is stale';
  };

  const formatDataAge = () => {
    if (!dataAge) return 'Unknown';
    if (dataAge < 1) return `${Math.round(dataAge * 60)} minutes ago`;
    if (dataAge < 24) return `${Math.round(dataAge)} hours ago`;
    return `${Math.round(dataAge / 24)} days ago`;
  };

  return (
    <div className={`rounded-lg border p-4 mb-6 ${getBannerColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Snapshot Data
            </h3>
            <p className="text-sm text-gray-600">
              {getStatusText()} • {formatDataAge()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{(() => {
              try {
                const snapshotDate = snapshotMetadata.snapshotDate;
                if (!snapshotDate) return 'Unknown';
                const date = new Date(snapshotDate);
                if (isNaN(date.getTime())) {
                  console.error('Invalid snapshotDate value in SnapshotInfoBanner:', snapshotDate);
                  return 'Unknown';
                }
                return format(date, 'MMM dd, yyyy');
              } catch (error) {
                console.error('Date formatting error in SnapshotInfoBanner snapshotDate:', error, snapshotMetadata.snapshotDate);
                return 'Unknown';
              }
            })()}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{(() => {
              try {
                const fetchedAt = snapshotMetadata.fetchedAt;
                if (!fetchedAt) return 'Unknown';
                const date = new Date(fetchedAt);
                if (isNaN(date.getTime())) {
                  console.error('Invalid fetchedAt value in SnapshotInfoBanner:', fetchedAt);
                  return 'Unknown';
                }
                return format(date, "HH:mm 'UTC'");
              } catch (error) {
                console.error('Date formatting error in SnapshotInfoBanner fetchedAt:', error, snapshotMetadata.fetchedAt);
                return 'Unknown';
              }
            })()}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{snapshotMetadata.memberCount} members</span>
          </div>
        </div>
      </div>
      
      {/* Additional metadata */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>War Log: {snapshotMetadata.warLogEntries} entries</span>
            <span>Capital Seasons: {snapshotMetadata.capitalSeasons}</span>
            <span>Version: {snapshotMetadata.version}</span>
          </div>
          
          {snapshotDetails?.currentWar && (
            <div className="flex items-center space-x-2">
              <span className="font-medium">Current War:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                snapshotDetails.currentWar.state === 'inWar' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {snapshotDetails.currentWar.state}
              </span>
              {snapshotDetails.currentWar.opponent && (
                <span>vs {snapshotDetails.currentWar.opponent.name}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
