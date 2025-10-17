'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { GlassCard, Button } from '@/components/ui';

export interface AlertThresholds {
  inactivityDays: number;
  lowDonations: number;
  warParticipationMin: number;
  elderPromotionDonations: number;
  elderPromotionWarStars: number;
  capitalContributionMin: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  inactivityDays: 3,
  lowDonations: 50,
  warParticipationMin: 5,
  elderPromotionDonations: 200,
  elderPromotionWarStars: 10,
  capitalContributionMin: 500,
};

interface CommandCenterSettingsProps {
  onSave?: (thresholds: AlertThresholds) => void;
  initialThresholds?: Partial<AlertThresholds>;
}

export const CommandCenterSettings = ({ onSave, initialThresholds }: CommandCenterSettingsProps) => {
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    ...DEFAULT_THRESHOLDS,
    ...initialThresholds,
  });
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('commandCenterThresholds');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const loadedThresholds = { ...DEFAULT_THRESHOLDS, ...parsed };
        setThresholds(loadedThresholds);
        // Don't call onSave here to prevent infinite loop
      } catch (error) {
        console.error('Failed to parse stored thresholds:', error);
      }
    } else if (initialThresholds) {
      // If no stored settings but initialThresholds provided, use those
      setThresholds({ ...DEFAULT_THRESHOLDS, ...initialThresholds });
    }
  }, [initialThresholds]);

  const handleSave = () => {
    localStorage.setItem('commandCenterThresholds', JSON.stringify(thresholds));
    onSave?.(thresholds);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    localStorage.removeItem('commandCenterThresholds');
    onSave?.(DEFAULT_THRESHOLDS);
  };

  const handleChange = (key: keyof AlertThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  };

  return (
    <GlassCard className="p-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-gray-100">Alert Settings</h2>
        </div>
        <button className="text-sm text-gray-400 hover:text-gray-200">
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* Inactivity Alert */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Inactivity Alert Threshold</span>
              <span className="text-gray-500">{thresholds.inactivityDays} days</span>
            </label>
            <input
              type="range"
              min="1"
              max="14"
              value={thresholds.inactivityDays}
              onChange={(e) => handleChange('inactivityDays', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-xs text-gray-500">
              Alert when a member hasn&apos;t been active for this many days
            </p>
          </div>

          {/* Low Donations */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Low Donations Threshold</span>
              <span className="text-gray-500">{thresholds.lowDonations} donations</span>
            </label>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={thresholds.lowDonations}
              onChange={(e) => handleChange('lowDonations', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <p className="text-xs text-gray-500">
              Alert when donations are below this amount per season
            </p>
          </div>

          {/* War Participation */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Minimum War Participation</span>
              <span className="text-gray-500">{thresholds.warParticipationMin} wars</span>
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={thresholds.warParticipationMin}
              onChange={(e) => handleChange('warParticipationMin', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <p className="text-xs text-gray-500">
              Expected minimum war participation per season
            </p>
          </div>

          {/* Elder Promotion - Donations */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Elder Promotion - Donations</span>
              <span className="text-gray-500">{thresholds.elderPromotionDonations} donations</span>
            </label>
            <input
              type="range"
              min="100"
              max="500"
              step="50"
              value={thresholds.elderPromotionDonations}
              onChange={(e) => handleChange('elderPromotionDonations', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-xs text-gray-500">
              Minimum donations required for elder promotion consideration
            </p>
          </div>

          {/* Elder Promotion - War Stars */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Elder Promotion - War Stars</span>
              <span className="text-gray-500">{thresholds.elderPromotionWarStars} stars</span>
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={thresholds.elderPromotionWarStars}
              onChange={(e) => handleChange('elderPromotionWarStars', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-xs text-gray-500">
              Minimum war stars required for elder promotion consideration
            </p>
          </div>

          {/* Capital Contribution */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Minimum Capital Contribution</span>
              <span className="text-gray-500">{thresholds.capitalContributionMin.toLocaleString()} gold</span>
            </label>
            <input
              type="range"
              min="0"
              max="2000"
              step="100"
              value={thresholds.capitalContributionMin}
              onChange={(e) => handleChange('capitalContributionMin', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <p className="text-xs text-gray-500">
              Expected minimum capital gold contribution per week
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 min-h-[44px]"
              disabled={saved}
            >
              {saved ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="min-h-[44px]"
              aria-label="Reset to defaults"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-gray-300">
              💡 <strong>Tip:</strong> Adjust these thresholds based on your clan&apos;s activity level 
              and expectations. Settings are saved locally in your browser.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export default CommandCenterSettings;
