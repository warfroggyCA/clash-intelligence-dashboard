/**
 * ModalsContainer Component
 * 
 * Centralized container for all modal components in the dashboard.
 * Manages modal state and provides consistent modal behavior.
 * 
 * Features:
 * - Centralized modal management
 * - Consistent modal behavior
 * - Proper z-index management
 * - Accessibility features
 * - State synchronization
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React from 'react';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import LeadershipGuard from '@/components/LeadershipGuard';
import { Modal } from '@/components/ui';
import DepartureManager from '@/components/DepartureManager';
import AccessManager from '@/components/AccessManager';
import AccessSetup from '@/components/AccessSetup';
import AccessLogin from '@/components/AccessLogin';
import { PlayerProfileModal } from './PlayerProfileModal';
import { SettingsModal } from './SettingsModal';
import { showToast } from '@/lib/toast';
import { QuickDepartureModal } from './QuickDepartureModal';

// =============================================================================
// TYPES
// =============================================================================

export interface ModalsContainerProps {
  className?: string;
}

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

const DepartureManagerModal: React.FC = () => {
  const {
    showDepartureManager,
    setShowDepartureManager,
    departureNotificationsData,
    setDepartureNotificationsData,
    dismissedNotifications,
    setDismissedNotifications
  } = useDashboardStore();

  const handleClose = () => {
    setShowDepartureManager(false);
  };

  const handleNotificationChange = (updatedData: any) => {
    setDepartureNotificationsData(updatedData);
  };

  const handleDismissAll = () => {
    if (departureNotificationsData) {
      const newDismissed = new Set(dismissedNotifications);
      departureNotificationsData.rejoins.forEach(rejoin => {
        newDismissed.add(rejoin.memberTag);
      });
      departureNotificationsData.activeDepartures.forEach(departure => {
        newDismissed.add(departure.memberTag);
      });
      setDismissedNotifications(newDismissed);
    }
  };

  if (!showDepartureManager) return null;

  return (
    <LeadershipGuard
      requiredPermission="canManageChangeDashboard"
      fallback={
        <Modal
          isOpen={showDepartureManager}
          onClose={handleClose}
          title="Departure Manager"
          size="lg"
        >
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Departure Manager</h3>
            <p className="text-gray-600 mb-4">This feature requires leadership access.</p>
            <p className="text-sm text-gray-500 mb-4">Use the role selector in the top right to switch to Leader or Co-Leader role.</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </Modal>
      }
    >
      <DepartureManager
        clanTag={useDashboardStore.getState().clanTag || useDashboardStore.getState().homeClan || ""}
        onClose={handleClose}
        onNotificationChange={handleNotificationChange}
        onDismissAll={handleDismissAll}
        cachedNotifications={departureNotificationsData}
      />
    </LeadershipGuard>
  );
};

const AccessManagementModals: React.FC = () => {
  const {
    showAccessManager,
    setShowAccessManager,
    showAccessSetup,
    setShowAccessSetup,
    showAccessLogin,
    setShowAccessLogin,
    currentAccessMember,
    setCurrentAccessMember,
    accessPermissions,
    setAccessPermissions,
    clanTag,
    homeClan
  } = useDashboardStore();

  const currentClanTag = clanTag || homeClan || "";
  const clanName = useDashboardStore.getState().roster?.clanName || "";

  return (
    <>
      {/* Access Manager Modal */}
      {showAccessManager && (
        <AccessManager
          clanTag={currentClanTag}
          clanName={clanName}
          onClose={() => setShowAccessManager(false)}
        />
      )}

      {/* Access Setup Modal */}
      {showAccessSetup && (
        <AccessSetup
          clanTag={currentClanTag}
          clanName={clanName}
          onAccessCreated={(ownerPassword) => {
            console.log('Access created with password:', ownerPassword);
            setShowAccessSetup(false);
          }}
          onClose={() => setShowAccessSetup(false)}
        />
      )}

      {/* Access Login Modal */}
      {showAccessLogin && (
        <AccessLogin
          clanTag={currentClanTag}
          clanName={clanName}
          onAccessGranted={(accessMember, permissions) => {
            setCurrentAccessMember(accessMember);
            setAccessPermissions(permissions);
            setShowAccessLogin(false);
          }}
          onClose={() => setShowAccessLogin(false)}
        />
      )}
    </>
  );
};

const SettingsModals: React.FC = () => {
  const {
    showSettings,
    setShowSettings
  } = useDashboardStore();

  return (
    <>
      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

const PlayerProfileModals: React.FC = () => {
  const {
    showPlayerProfile,
    setShowPlayerProfile,
    selectedPlayer,
    setSelectedPlayer,
    showDepartureModal,
    setShowDepartureModal,
    selectedMember,
    setSelectedMember,
    roster,
    clanTag,
    homeClan
  } = useDashboardStore();

  const currentClanTag = clanTag || homeClan || "";

  return (
    <>
      {/* Player Profile Modal */}
      {showPlayerProfile && selectedPlayer && (
        <PlayerProfileModal
          member={selectedPlayer}
          clanTag={currentClanTag}
          roster={roster}
          onClose={() => {
            setShowPlayerProfile(false);
            setSelectedPlayer(null);
          }}
        />
      )}

      {/* Quick Departure Modal */}
      {showDepartureModal && selectedMember && (
        <QuickDepartureModal
          member={selectedMember}
          onClose={() => {
            setShowDepartureModal(false);
            setSelectedMember(null);
          }}
          onSave={(departureData) => {
            showToast('Departure recorded','success');
            setShowDepartureModal(false);
            setSelectedMember(null);
          }}
        />
      )}
    </>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ModalsContainer: React.FC<ModalsContainerProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      {/* Settings Modals */}
      <SettingsModals />
      
      {/* Departure Manager Modal */}
      <DepartureManagerModal />
      
      {/* Access Management Modals */}
      <AccessManagementModals />
      
      {/* Player Profile Modals */}
      <PlayerProfileModals />
    </div>
  );
};

export default ModalsContainer;
