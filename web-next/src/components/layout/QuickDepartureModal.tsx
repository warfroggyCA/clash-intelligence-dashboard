/**
 * QuickDepartureModal Component
 * 
 * A modal for quickly recording member departures with reason and notes.
 * Provides a streamlined interface for departure management.
 * 
 * Features:
 * - Quick departure recording
 * - Reason selection
 * - Notes and details
 * - Form validation
 * - Responsive design
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState } from 'react';
import { Member } from '@/types';
import { Modal, Button, SuccessButton, DangerButton } from '@/components/ui';
import { Input } from '@/components/ui';

// =============================================================================
// TYPES
// =============================================================================

export interface QuickDepartureModalProps {
  member: Member;
  onClose: () => void;
  onSave: (departureData: DepartureData) => void;
}

export interface DepartureData {
  memberTag: string;
  memberName: string;
  departureDate: string;
  departureReason: string;
  notes: string;
  lastSeen: string;
  lastRole: string;
  lastTownHall: number;
  lastTrophies: number;
}

// =============================================================================
// DEPARTURE REASONS
// =============================================================================

const DEPARTURE_REASONS = [
  'Inactive',
  'Left voluntarily',
  'Kicked for inactivity',
  'Kicked for behavior',
  'Kicked for war performance',
  'Kicked for other reasons',
  'Unknown'
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export const QuickDepartureModal: React.FC<QuickDepartureModalProps> = ({
  member,
  onClose,
  onSave
}) => {
  const [departureReason, setDepartureReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!departureReason.trim()) {
      alert('Please select a departure reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const departureData: DepartureData = {
        memberTag: member.tag,
        memberName: member.name,
        departureDate: new Date().toISOString(),
        departureReason: departureReason.trim(),
        notes: notes.trim(),
        lastSeen: new Date().toISOString(),
        lastRole: member.role || 'Member',
        lastTownHall: member.townHallLevel || member.th || 0,
        lastTrophies: member.trophies || 0
      };

      await onSave(departureData);
    } catch (error) {
      console.error('Failed to save departure:', error);
      alert('Failed to save departure data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    try {
      // Check if the date string contains invalid characters
      if (typeof dateString !== 'string' || dateString.includes('U') || dateString.includes('u')) {
        console.error('Invalid date string contains U character:', dateString);
        return 'Invalid Date';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateString);
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Record Departure - ${member.name}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Member Summary */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Member Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>
              <span className="ml-2 font-semibold">{member.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Tag:</span>
              <span className="ml-2 font-semibold">{member.tag}</span>
            </div>
            <div>
              <span className="text-gray-600">Town Hall:</span>
              <span className="ml-2 font-semibold">TH{member.townHallLevel || member.th || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Trophies:</span>
              <span className="ml-2 font-semibold">{member.trophies?.toLocaleString() || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Role:</span>
              <span className="ml-2 font-semibold capitalize">{member.role || 'Member'}</span>
            </div>
            <div>
              <span className="text-gray-600">Tenure:</span>
              <span className="ml-2 font-semibold">
                {member.tenure_days || member.tenure || 0} days
              </span>
            </div>
          </div>
        </div>

        {/* Departure Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departure Reason *
            </label>
            <select
              value={departureReason}
              onChange={(e) => setDepartureReason(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="">Select a reason...</option>
              {DEPARTURE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details about the departure..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              rows={4}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start">
              <div className="text-yellow-600 mr-2">⚠️</div>
              <div className="text-sm text-yellow-800">
                <strong>Note:</strong> This action will record the member&apos;s departure and may affect 
                clan statistics and analytics. This action cannot be undone.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <DangerButton
            onClick={handleSave}
            loading={isSubmitting}
            disabled={!departureReason.trim()}
          >
            Record Departure
          </DangerButton>
        </div>
      </div>
    </Modal>
  );
};

export default QuickDepartureModal;
