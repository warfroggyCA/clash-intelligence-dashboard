'use client';

import { useState } from 'react';
import { Award, Copy, Download, MessageSquare, CheckCircle } from 'lucide-react';
import { GlassCard, Button } from '@/components/ui';
import type { Member } from '@/types';
import { 
  formatElderPromotionsForDiscord, 
  exportElderCandidatesToCSV, 
  copyToClipboard, 
  downloadCSV 
} from '@/lib/export-utils';

interface ElderPromotionPanelProps {
  candidates: Member[];
}

export const ElderPromotionPanel = ({ candidates }: ElderPromotionPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleCopyDiscord = async () => {
    const formatted = formatElderPromotionsForDiscord(candidates);
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadCSV = () => {
    const csv = exportElderCandidatesToCSV(candidates);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(`elder-candidates-${date}.csv`, csv);
  };

  const getPromotionScore = (member: Member): number => {
    let score = 0;
    
    // Trophies (max 30 points)
    const trophies = member.trophies || 0;
    score += Math.min((trophies / 100), 30);
    
    // Donations (max 30 points)
    const donations = member.donations || 0;
    score += Math.min((donations / 10), 30);
    
    // War Stars (max 20 points)
    const warStars = member.warStars || 0;
    score += Math.min(warStars * 2, 20);
    
    // Capital Contributions (max 20 points)
    const capital = member.clanCapitalContributions || 0;
    score += Math.min((capital / 100), 20);
    
    return Math.round(score);
  };

  if (candidates.length === 0) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-gray-100">Elder Promotion Candidates</h2>
        </div>
        <p className="text-gray-400 text-center py-8">
          No members currently meet the promotion criteria. Keep monitoring performance!
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-gray-100">Elder Promotion Candidates</h2>
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-semibold">
            {candidates.length} Ready
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyDiscord}
            className="min-h-[44px]"
            aria-label="Copy as Discord message"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Copy Discord
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCSV}
            className="min-h-[44px]"
            aria-label="Download as CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {candidates.map((member) => {
          const score = getPromotionScore(member);
          const isExpanded = expandedMember === member.tag;
          
          return (
            <div
              key={member.tag}
              className="bg-brand-surfaceRaised border border-brand-border rounded-lg p-4 hover:border-purple-500/50 transition-all cursor-pointer"
              onClick={() => setExpandedMember(isExpanded ? null : member.tag)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Award className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">{member.name}</h3>
                    <p className="text-sm text-gray-400">
                      {member.role || 'member'} • TH{member.townHallLevel || member.th || '?'}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-400">{score}/100</div>
                  <p className="text-xs text-gray-500">Promotion Score</p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Trophies</p>
                    <p className="text-lg font-bold text-gray-100">
                      {member.trophies?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Donations</p>
                    <p className="text-lg font-bold text-gray-100">
                      {member.donations?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">War Stars</p>
                    <p className="text-lg font-bold text-gray-100">
                      {member.warStars || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Capital Gold</p>
                    <p className="text-lg font-bold text-gray-100">
                      {member.clanCapitalContributions?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-sm text-gray-300">
          <strong>💡 Promotion Criteria:</strong> High activity, consistent donations (200+), 
          strong war performance, and capital contributions. Click members for detailed stats.
        </p>
      </div>
    </GlassCard>
  );
};

export default ElderPromotionPanel;
