"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  PlayerDNA, 
  PlayerArchetype, 
  calculatePlayerDNA, 
  classifyPlayerArchetype, 
  getArchetypeInfo,
  calculateClanDNA,
  Member 
} from '@/lib/player-dna';
import PlayerDNARadar from './PlayerDNARadar';
import { 
  Users, 
  TrendingUp, 
  Heart, 
  MessageCircle, 
  Target, 
  Clock,
  Crown,
  Star,
  Gift,
  Zap
} from 'lucide-react';

interface PlayerDNADashboardProps {
  members: Member[];
  clanTag: string;
}

export default function PlayerDNADashboard({ members, clanTag }: PlayerDNADashboardProps) {
  const aiEnabled = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';
  const [selectedPlayer, setSelectedPlayer] = useState<Member | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'individual'>('overview');
  const [cachedDNAs, setCachedDNAs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load cached DNA profiles from batch AI results
  useEffect(() => {
    if (!aiEnabled) return; // Skip in dev unless explicitly enabled
    loadCachedDNAs();
  }, [clanTag, aiEnabled]);

  const loadCachedDNAs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ai/dna-cache?clanTag=${encodeURIComponent(clanTag)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCachedDNAs(result.data);
          console.log('[DNA Dashboard] Loaded cached DNA profiles');
        }
      }
    } catch (error) {
      console.error('[DNA Dashboard] Error loading cached DNA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate DNA for all members (with fallback to real-time calculation)
  const memberDNAs = useMemo(() => {
    if (members.length === 0) return [];

    const clanAverages = {
      averageDonations: members.reduce((sum, m) => sum + (m.donations ?? 0), 0) / members.length,
      averageWarStars: members.reduce((sum, m) => sum + (m.warStars ?? 0), 0) / members.length,
      averageCapitalContributions: members.reduce((sum, m) => sum + (m.clanCapitalContributions ?? 0), 0) / members.length,
      totalMembers: members.length
    };

    return members.map(member => {
      // Try to find cached DNA first
      const cachedDNA = aiEnabled ? cachedDNAs.find(cached => cached.player_tag === member.tag) : null;
      
      if (cachedDNA) {
        return {
          member,
          dna: cachedDNA.dna_profile,
          archetype: cachedDNA.archetype,
          cached: true
        };
      } else {
        // Fallback to real-time calculation
        const dna = calculatePlayerDNA(member, clanAverages);
        return {
          member,
          dna,
          archetype: classifyPlayerArchetype(dna, member),
          cached: false
        };
      }
    });
  }, [members, cachedDNAs, aiEnabled]);

  // Calculate clan DNA summary
  const clanDNA = useMemo(() => {
    return calculateClanDNA(members);
  }, [members]);

  const selectedPlayerDNA = selectedPlayer ? memberDNAs.find(m => m.member.tag === selectedPlayer.tag) : null;

  return (
    <div className="space-y-6">
      {process.env.NODE_ENV === 'development' && !aiEnabled && (
        <div className="text-xs text-gray-600">AI features are disabled in dev. Set NEXT_PUBLIC_ENABLE_AI=true to enable.</div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🧬 Player DNA Analysis</h2>
          <p className="text-gray-600">Revolutionary multi-dimensional player classification system</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'overview' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Clan Overview
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'individual' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            Individual Analysis
          </button>
        </div>
      </div>

      {viewMode === 'overview' ? (
        <div className="space-y-6">
          {/* Clan DNA Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Clan Strengths */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-green-800">Clan Strengths</h3>
              </div>
              <div className="space-y-2">
                {clanDNA.clanStrengths.length > 0 ? (
                  clanDNA.clanStrengths.map((strength, index) => (
                    <div key={index} className="flex items-center text-green-700">
                      <Star className="w-4 h-4 mr-2" />
                      {strength}
                    </div>
                  ))
                ) : (
                  <p className="text-green-600 text-sm">No major strengths identified</p>
                )}
              </div>
            </div>

            {/* Improvement Areas */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Zap className="w-6 h-6 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold text-orange-800">Improvement Areas</h3>
              </div>
              <div className="space-y-2">
                {clanDNA.improvementAreas.length > 0 ? (
                  clanDNA.improvementAreas.map((area, index) => (
                    <div key={index} className="flex items-center text-orange-700">
                      <Target className="w-4 h-4 mr-2" />
                      {area}
                    </div>
                  ))
                ) : (
                  <p className="text-orange-600 text-sm">All areas performing well!</p>
                )}
              </div>
            </div>

            {/* Average DNA */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Crown className="w-6 h-6 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-800">Average DNA</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Leadership:</span>
                  <span className="font-medium">{clanDNA.averageDNA.leadership}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Performance:</span>
                  <span className="font-medium">{clanDNA.averageDNA.performance}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Generosity:</span>
                  <span className="font-medium">{clanDNA.averageDNA.generosity}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Social:</span>
                  <span className="font-medium">{clanDNA.averageDNA.social}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Specialization:</span>
                  <span className="font-medium">{clanDNA.averageDNA.specialization}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Consistency:</span>
                  <span className="font-medium">{clanDNA.averageDNA.consistency}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Archetype Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Player Archetype Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(clanDNA.archetypeDistribution).map(([archetype, count]) => {
                const info = getArchetypeInfo(archetype as PlayerArchetype);
                const percentage = Math.round((count / members.length) * 100);
                
                return (
                  <div key={archetype} className="text-center">
                    <div 
                      className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white font-bold text-xs mb-2"
                      style={{ backgroundColor: info.color }}
                    >
                      {count}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{archetype}</p>
                    <p className="text-xs text-gray-600">{percentage}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Performers by Dimension */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { key: 'leadership', label: 'Leadership', icon: Crown, color: 'purple' },
              { key: 'performance', label: 'Performance', icon: Star, color: 'blue' },
              { key: 'generosity', label: 'Generosity', icon: Gift, color: 'green' },
              { key: 'social', label: 'Social', icon: MessageCircle, color: 'pink' },
              { key: 'specialization', label: 'Specialization', icon: Target, color: 'indigo' },
              { key: 'consistency', label: 'Consistency', icon: Clock, color: 'orange' }
            ].map(({ key, label, icon: Icon, color }) => {
              const topPlayer = memberDNAs.reduce((prev, current) => 
                current.dna[key as keyof PlayerDNA] > prev.dna[key as keyof PlayerDNA] ? current : prev
              );
              
              return (
                <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
                  <div className="flex items-center mb-3">
                    <Icon className={`w-5 h-5 text-${color}-600 mr-2`} />
                    <h4 className={`font-semibold text-${color}-800`}>Top {label}</h4>
                  </div>
                  <div className="space-y-1">
                    <p className={`font-medium text-${color}-700`}>{topPlayer.member.name}</p>
                    <p className={`text-sm text-${color}-600`}>{topPlayer.dna[key as keyof PlayerDNA]}%</p>
                    <div 
                      className="inline-block px-2 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: getArchetypeInfo(topPlayer.archetype).color }}
                    >
                      {topPlayer.archetype}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Player Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Player for Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {memberDNAs.map(({ member, archetype }) => {
                const info = getArchetypeInfo(archetype);
                const isSelected = selectedPlayer?.tag === member.tag;
                
                return (
                  <button
                    key={member.tag}
                    onClick={() => setSelectedPlayer(member)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-800 truncate">{member.name}</p>
                      <div 
                        className="inline-block px-2 py-1 rounded text-xs text-white mt-1"
                        style={{ backgroundColor: info.color }}
                      >
                        {archetype}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Individual Player Analysis */}
          {selectedPlayerDNA && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* DNA Radar Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedPlayerDNA.member.name} - DNA Profile
                </h3>
                <div className="flex justify-center">
                  <PlayerDNARadar
                    dna={selectedPlayerDNA.dna}
                    archetype={selectedPlayerDNA.archetype}
                    playerName={selectedPlayerDNA.member.name}
                    size={300}
                  />
                </div>
              </div>

              {/* Archetype Analysis */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Archetype Analysis</h3>
                {(() => {
                  const info = getArchetypeInfo(selectedPlayerDNA.archetype);
                  return (
                    <div className="space-y-4">
                      <div 
                        className="inline-block px-4 py-2 rounded-full text-white font-semibold"
                        style={{ backgroundColor: info.color }}
                      >
                        {selectedPlayerDNA.archetype}
                      </div>
                      
                      <p className="text-gray-700">{info.description}</p>
                      
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2">Strengths:</h4>
                        <ul className="space-y-1">
                          {info.strengths.map((strength, index) => (
                            <li key={index} className="flex items-center text-gray-700">
                              <Star className="w-4 h-4 text-yellow-500 mr-2" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2">Optimal Roles:</h4>
                        <ul className="space-y-1">
                          {info.optimalRoles.map((role, index) => (
                            <li key={index} className="flex items-center text-gray-700">
                              <Target className="w-4 h-4 text-blue-500 mr-2" />
                              {role}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
