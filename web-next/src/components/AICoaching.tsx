"use client";

import { useState, useEffect } from "react";
import { Copy, MessageSquare, TrendingUp, Users, Shield, Trophy, Star, AlertTriangle } from "lucide-react";

interface Member {
  name: string;
  tag: string;
  townHallLevel?: number;
  th?: number;
  bk?: number;
  aq?: number;
  gw?: number;
  rc?: number;
  mp?: number;
  trophies?: number;
  donations?: number;
  donationsReceived?: number;
  warStars?: number;
  tenure_days?: number;
  tenure?: number;
  lastSeen?: string | number;
  role?: string;
  recentClans?: string[];
}

interface Roster {
  source: "live" | "fallback" | "snapshot";
  date?: string;
  clanName?: string;
  members: Member[];
  meta?: any;
}

interface CoachingAdvice {
  category: string;
  title: string;
  description: string;
  chatMessage?: string;
  priority: "high" | "medium" | "low";
  icon: string;
}

interface AICoachingProps {
  clanData: Roster | null;
  clanTag: string;
}

export default function AICoaching({ clanData, clanTag }: AICoachingProps) {
  const [advice, setAdvice] = useState<CoachingAdvice[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [actionedTips, setActionedTips] = useState<Set<string>>(new Set());
  const [showActioned, setShowActioned] = useState(false);

  useEffect(() => {
    // Load existing coaching advice from localStorage instead of auto-generating
    if (clanData?.members) {
      loadExistingAdvice();
    }
  }, [clanData]);

  useEffect(() => {
    // Load actioned tips from localStorage
    const saved = localStorage.getItem(`actioned_tips_${clanTag}`);
    if (saved) {
      try {
        setActionedTips(new Set(JSON.parse(saved)));
      } catch (error) {
        console.error('Failed to load actioned tips:', error);
      }
    }
  }, [clanTag]);

  const loadExistingAdvice = () => {
    // Try to load existing coaching advice from localStorage
    const saved = localStorage.getItem(`coaching_advice_${clanTag}`);
    if (saved) {
      try {
        const parsedAdvice = JSON.parse(saved);
        setAdvice(parsedAdvice);
      } catch (error) {
        console.error('Failed to load existing coaching advice:', error);
        setAdvice([]);
      }
    } else {
      // No existing advice, show empty state
      setAdvice([]);
    }
  };

  const generateCoachingAdvice = async () => {
    if (!clanData?.members || clanData.members.length === 0) {
      setAdvice([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai-coaching/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanData: {
            clanName: clanData.clanName,
            clanTag,
            memberCount: clanData.members.length,
            members: clanData.members.map(member => ({
              name: member.name,
              tag: member.tag,
              townHall: member.townHallLevel || member.th,
              role: member.role,
              trophies: member.trophies,
              donations: member.donations,
              donationsReceived: member.donationsReceived,
              tenure: member.tenure_days || member.tenure,
              lastSeen: member.lastSeen,
              heroes: {
                barbarianKing: member.bk,
                archerQueen: member.aq,
                grandWarden: member.gw,
                royalChampion: member.rc,
                minionPrince: member.mp
              }
            }))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const newAdvice = result.advice || [];
        setAdvice(newAdvice);
        // Save to localStorage for persistence
        localStorage.setItem(`coaching_advice_${clanTag}`, JSON.stringify(newAdvice));
      } else {
        // Fallback to local analysis if API fails
        const localAdvice = generateLocalAdvice();
        setAdvice(localAdvice);
        localStorage.setItem(`coaching_advice_${clanTag}`, JSON.stringify(localAdvice));
      }
    } catch (error) {
      console.error('Failed to generate AI coaching advice:', error);
      const localAdvice = generateLocalAdvice();
      setAdvice(localAdvice);
      localStorage.setItem(`coaching_advice_${clanTag}`, JSON.stringify(localAdvice));
    } finally {
      setLoading(false);
    }
  };

  const generateLocalAdvice = (): CoachingAdvice[] => {
    if (!clanData?.members) return [];

    const advice: CoachingAdvice[] = [];
    const members = clanData.members;

    // Analyze donations with specific names
    const totalDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;
    const topDonators = members.sort((a, b) => (b.donations || 0) - (a.donations || 0)).slice(0, 3);
    const lowDonators = members.filter(m => (m.donations || 0) < avgDonations * 0.5);
    
    if (topDonators.length > 0 && topDonators[0].donations && topDonators[0].donations > 0) {
      advice.push({
        category: "Donations",
        title: `${topDonators[0].name} Leading Donations`,
        description: `${topDonators[0].name} is our top donator with ${topDonators[0].donations} donations this season!`,
        chatMessage: `Shoutout to ${topDonators[0].name} for being our top donator with ${topDonators[0].donations} donations! 🎉 You're setting a great example for the clan!`,
        priority: "medium",
        icon: "👑"
      });
    }

    if (lowDonators.length > 0 && lowDonators.length <= 5) {
      advice.push({
        category: "Donations",
        title: `${lowDonators.map(m => m.name).join(', ')} Need More Donations`,
        description: `${lowDonators.map(m => m.name).join(', ')} are below the clan average of ${Math.round(avgDonations)} donations.`,
        chatMessage: `Hey ${lowDonators.map(m => m.name).join(', ')}! Let's step up our donation game! The clan average is ${Math.round(avgDonations)} - we believe in you! 💪`,
        priority: "high",
        icon: "📈"
      });
    }

    // Analyze inactive members with specific names
    const inactiveMembers = members.filter(m => 
      typeof m.lastSeen === "number" && m.lastSeen > 3
    );
    
    if (inactiveMembers.length > 0 && inactiveMembers.length <= 5) {
      advice.push({
        category: "Activity",
        title: `${inactiveMembers.map(m => m.name).join(', ')} Haven't Been Active`,
        description: `${inactiveMembers.map(m => `${m.name} (${m.lastSeen} days)`).join(', ')} haven't been seen recently.`,
        chatMessage: `Hey ${inactiveMembers.map(m => m.name).join(', ')}! We miss you! ${inactiveMembers.map(m => `${m.name} hasn't been seen in ${m.lastSeen} days`).join(', ')}. Hope everything's okay! 🤝`,
        priority: "high",
        icon: "⏰"
      });
    }

    // Analyze new members with specific names
    const newMembers = members.filter(m => 
      (m.tenure_days || m.tenure || 0) < 7
    );
    
    if (newMembers.length > 0 && newMembers.length <= 5) {
      advice.push({
        category: "New Members",
        title: `Welcome ${newMembers.map(m => m.name).join(', ')}`,
        description: `${newMembers.map(m => m.name).join(', ')} joined the clan recently and need a warm welcome.`,
        chatMessage: `Welcome to the clan ${newMembers.map(m => m.name).join(', ')}! 🎉 We're excited to have you here. Don't hesitate to ask for troops or advice!`,
        priority: "high",
        icon: "🎉"
      });
    }

    // Analyze trophy achievements
    const highTrophyMembers = members.filter(m => (m.trophies || 0) > 2000);
    const lowTrophyMembers = members.filter(m => (m.trophies || 0) < 1000);
    
    if (highTrophyMembers.length > 0 && highTrophyMembers.length <= 3) {
      advice.push({
        category: "Trophies",
        title: `${highTrophyMembers.map(m => m.name).join(', ')} in High Leagues`,
        description: `${highTrophyMembers.map(m => `${m.name} (${m.trophies} trophies)`).join(', ')} are in high trophy leagues!`,
        chatMessage: `Amazing work ${highTrophyMembers.map(m => m.name).join(', ')}! ${highTrophyMembers.map(m => `${m.name} is at ${m.trophies} trophies`).join(', ')} - you're inspiring the rest of us! 🏆`,
        priority: "medium",
        icon: "🏆"
      });
    }

    if (lowTrophyMembers.length > 0 && lowTrophyMembers.length <= 5) {
      advice.push({
        category: "Trophies",
        title: `${lowTrophyMembers.map(m => m.name).join(', ')} Trophy Push Opportunity`,
        description: `${lowTrophyMembers.map(m => `${m.name} (${m.trophies} trophies)`).join(', ')} are below 1000 trophies and could benefit from a push.`,
        chatMessage: `Hey ${lowTrophyMembers.map(m => m.name).join(', ')}! Let's get those trophies up! ${lowTrophyMembers.map(m => `${m.name} is at ${m.trophies}`).join(', ')} - we can help you climb! 📈`,
        priority: "medium",
        icon: "📈"
      });
    }

    return advice;
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(messageId);
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const markAsActioned = (tipId: string) => {
    const newActionedTips = new Set(actionedTips);
    newActionedTips.add(tipId);
    setActionedTips(newActionedTips);
    
    // Save to localStorage
    localStorage.setItem(`actioned_tips_${clanTag}`, JSON.stringify([...newActionedTips]));
  };

  const clearAllActioned = () => {
    setActionedTips(new Set());
    localStorage.removeItem(`actioned_tips_${clanTag}`);
  };

  const generateTipId = (tip: CoachingAdvice, index: number): string => {
    // Create a unique ID based on the tip content and clan data
    return `${clanTag}_${tip.category}_${tip.title}_${index}`.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-200 bg-red-50";
      case "medium": return "border-yellow-200 bg-yellow-50";
      case "low": return "border-green-200 bg-green-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high": return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "medium": return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      case "low": return <Star className="w-5 h-5 text-green-600" />;
      default: return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  if (!clanData) {
    return (
      <div className="text-center py-8 text-gray-500">
        Load clan data first to get AI coaching advice.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Coaching</h2>
          <p className="text-sm text-gray-600 mt-1">Expert Clash of Clans advice and ready-to-paste chat messages</p>
          {advice.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {advice.filter((item, index) => !actionedTips.has(generateTipId(item, index))).length} active tips
              {actionedTips.size > 0 && ` • ${actionedTips.size} actioned`}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {actionedTips.size > 0 && (
            <>
              <button
                onClick={() => setShowActioned(!showActioned)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  showActioned 
                    ? "bg-gray-200 text-gray-700" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {showActioned ? "Hide" : "Show"} Actioned ({actionedTips.size})
              </button>
              {showActioned && (
                <button
                  onClick={clearAllActioned}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  title="Clear all actioned tips"
                >
                  🗑️ Clear All
                </button>
              )}
            </>
          )}
          <button
            onClick={generateCoachingAdvice}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "🤖 Generate New Advice"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Analyzing clan data...</span>
        </div>
      ) : advice.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No coaching advice generated yet.</p>
          <p className="text-sm">Click "Generate New Advice" to get personalized coaching tips for your clan!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {advice
            .map((item, index) => ({ item, index, tipId: generateTipId(item, index) }))
            .filter(({ tipId }) => showActioned ? actionedTips.has(tipId) : !actionedTips.has(tipId))
            .sort((a, b) => {
              // Sort by priority: high > medium > low
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.item.priority] - priorityOrder[a.item.priority];
            })
            .map(({ item, index, tipId }) => (
            <div
              key={tipId}
              className={`border rounded-lg p-6 ${getPriorityColor(item.priority)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(item.priority)}
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === "high" ? "bg-red-100 text-red-800" :
                        item.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {item.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{item.category}</p>
                  </div>
                </div>
                {!showActioned ? (
                  <button
                    onClick={() => markAsActioned(tipId)}
                    className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                    title="Mark as actioned"
                  >
                    <input type="checkbox" className="w-4 h-4" />
                    <span>✓ Actioned</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                    <input type="checkbox" className="w-4 h-4" checked readOnly />
                    <span>✓ Actioned</span>
                  </div>
                )}
              </div>

              <p className="text-gray-700 mb-4">{item.description}</p>

              {item.chatMessage && (
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Ready-to-paste chat message:</h4>
                    <button
                      onClick={() => copyToClipboard(item.chatMessage!, `message-${tipId}`)}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{copiedMessage === `message-${tipId}` ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded p-3 text-sm text-gray-800 font-mono">
                    {item.chatMessage}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
