"use client";

import { useState } from "react";
import { MessageSquare, Send, Settings, AlertTriangle, Users, Trophy, TrendingUp } from "lucide-react";

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
  role?: string;
  tenure_days?: number;
  tenure?: number;
  lastSeen?: string | number;
}

interface Roster {
  source: "live" | "fallback" | "snapshot";
  date?: string;
  clanName?: string;
  members: Member[];
  meta?: any;
}

interface DiscordPublisherProps {
  clanData: Roster | null;
  clanTag: string;
}

// Rush percentage calculation (same as in other components)
const getTH = (m: any): number => m.townHallLevel ?? m.th ?? 0;

type Caps = Partial<Record<"bk"|"aq"|"gw"|"rc"|"mp", number>>;

const rushPercent = (m: any, thCaps?: Map<number, Caps>): number => {
  const th = getTH(m) ?? 0; 
  const caps = thCaps?.get(th) || {};
  const keys: ("bk"|"aq"|"gw"|"rc"|"mp")[] = []; 
  for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
    if (caps[k] && caps[k]! > 0) keys.push(k);
  }
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) {
    const current = (m[k] ?? 0);
    const cap = caps[k]!;
    total += Math.max(0, cap - current) / cap;
  }
  return Math.round((total / keys.length) * 100);
};

const calculateThCaps = (members: any[]): Map<number, Caps> => {
  const caps = new Map<number, Caps>();
  for (const m of members) {
    const th = getTH(m); 
    if (th < 8) continue;
    const entry = caps.get(th) || {};
    for (const k of ["bk", "aq", "gw", "rc", "mp"] as const) {
      const v = m[k];
      if (typeof v === "number" && v > 0) {
        entry[k] = Math.max(entry[k] || 0, v);
      }
    }
    caps.set(th, entry);
  }
  return caps;
};

export default function DiscordPublisher({ clanData, clanTag }: DiscordPublisherProps) {
  const [selectedExhibit, setSelectedExhibit] = useState<string>("rushed");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [previewMessage, setPreviewMessage] = useState<string>("");

  // Load webhook URL from localStorage
  useState(() => {
    const saved = localStorage.getItem(`discord_webhook_${clanTag}`);
    if (saved) {
      setWebhookUrl(saved);
    }
  });

  const saveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem(`discord_webhook_${clanTag}`, url);
  };

  const generateRushedExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const thCaps = calculateThCaps(members);
    
    // Calculate rush percentages for all members
    const membersWithRush = members.map(member => {
      const rushPercentage = rushPercent(member, thCaps);
      return { ...member, rushPercentage };
    });

    // Filter for red (70%+) and amber (50-69%) level rushes
    const redRushedMembers = membersWithRush
      .filter(member => member.rushPercentage >= 70)
      .sort((a, b) => b.rushPercentage - a.rushPercentage);
    
    const amberRushedMembers = membersWithRush
      .filter(member => member.rushPercentage >= 50 && member.rushPercentage < 70)
      .sort((a, b) => b.rushPercentage - a.rushPercentage);

    const totalRushedMembers = redRushedMembers.length + amberRushedMembers.length;

    if (totalRushedMembers === 0) {
      return `🎯 **Rush Analysis for ${clanData.clanName || 'Your Clan'}**\n\n✅ **Great news!** No rushed players detected in the clan. Everyone is developing their bases at an appropriate pace for their Town Hall level.\n\n📊 **Rush Percentage Explained:** This bot tracks how far behind each player's heroes are compared to their Town Hall level. A higher percentage means they're more rushed and need to focus on heroes before advancing further.`;
    }

    let message = `🚨 **Rushed Players Analysis - ${clanData.clanName || 'Your Clan'}**\n\n`;
    message += `📊 **Rush Percentage Explained:** This bot tracks how far behind each player's heroes are compared to their Town Hall level. A higher percentage means they're more rushed and need to focus on heroes before advancing further.\n\n`;
    
    if (redRushedMembers.length > 0) {
      message += `🔴 **${redRushedMembers.length} severely rushed players (70%+)** need immediate attention:\n\n`;

      redRushedMembers.slice(0, 5).forEach((member, index) => {
        const th = getTH(member);
        
        message += `🔴 **${member.name}** (TH${th})\n`;
        message += `   • Rush Level: **${member.rushPercentage}%** (SEVERELY RUSHED!)\n`;
        
        // Add hero details
        const heroDetails = [];
        if (member.bk) heroDetails.push(`BK:${member.bk}`);
        if (member.aq) heroDetails.push(`AQ:${member.aq}`);
        if (member.gw) heroDetails.push(`GW:${member.gw}`);
        if (member.rc) heroDetails.push(`RC:${member.rc}`);
        if (member.mp) heroDetails.push(`MP:${member.mp}`);
        
        if (heroDetails.length > 0) {
          message += `   • Heroes: ${heroDetails.join(" | ")}\n`;
        }
        
        message += `   • Role: ${member.role || 'Member'}\n\n`;
      });

      if (redRushedMembers.length > 5) {
        message += `... and ${redRushedMembers.length - 5} more severely rushed players need attention.\n\n`;
      }
    }
    
    if (amberRushedMembers.length > 0) {
      message += `🟡 **${amberRushedMembers.length} moderately rushed players (50-69%)** need attention:\n\n`;

      amberRushedMembers.slice(0, 5).forEach((member, index) => {
        const th = getTH(member);
        
        message += `🟡 **${member.name}** (TH${th})\n`;
        message += `   • Rush Level: **${member.rushPercentage}%** (moderately rushed)\n`;
        
        // Add hero details
        const heroDetails = [];
        if (member.bk) heroDetails.push(`BK:${member.bk}`);
        if (member.aq) heroDetails.push(`AQ:${member.aq}`);
        if (member.gw) heroDetails.push(`GW:${member.gw}`);
        if (member.rc) heroDetails.push(`RC:${member.rc}`);
        if (member.mp) heroDetails.push(`MP:${member.mp}`);
        
        if (heroDetails.length > 0) {
          message += `   • Heroes: ${heroDetails.join(" | ")}\n`;
        }
        
        message += `   • Role: ${member.role || 'Member'}\n\n`;
      });

      if (amberRushedMembers.length > 5) {
        message += `... and ${amberRushedMembers.length - 5} more moderately rushed players need attention.\n\n`;
      }
    }

    if (redRushedMembers.length > 0) {
      message += `💡 **URGENT RECOMMENDATION:** Severely rushed players (70%+) need to STOP upgrading Town Hall and focus ONLY on heroes and defenses. Their rush level is severely impacting clan war performance!\n\n`;
    }
    if (amberRushedMembers.length > 0) {
      message += `💡 **MODERATE RECOMMENDATION:** Moderately rushed players (50-69%) should prioritize hero upgrades before advancing Town Hall. This will improve their war performance and clan contribution.`;
    }

    return message;
  };

  const generateDonationExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const totalDonations = members.reduce((sum, m) => sum + (m.donations || 0), 0);
    const avgDonations = totalDonations / members.length;

    // Find top and bottom performers
    const sortedByDonations = members.sort((a, b) => (b.donations || 0) - (a.donations || 0));
    const topDonators = sortedByDonations.slice(0, 5);
    const lowDonators = sortedByDonations.slice(-5).reverse();

    let message = `💝 **Donation Analysis for ${clanData.clanName || 'Your Clan'}**\n\n`;
    message += `📈 **Total Donations:** ${totalDonations.toLocaleString()}\n`;
    message += `📊 **Average per Member:** ${Math.round(avgDonations)}\n\n`;

    message += `🏆 **Top Donators:**\n`;
    topDonators.forEach((member, index) => {
      message += `${index + 1}. **${member.name}** - ${member.donations?.toLocaleString() || 0} donations\n`;
    });

    message += `\n⚠️ **Members Needing Improvement:**\n`;
    lowDonators.forEach((member, index) => {
      const donations = member.donations || 0;
      const deficit = avgDonations - donations;
      message += `${index + 1}. **${member.name}** - ${donations} donations (${Math.round(deficit)} below average)\n`;
    });

    return message;
  };

  const generateActivityExhibit = (): string => {
    if (!clanData || !clanData.members) return "";

    const members = clanData.members;
    const activeMembers = members.filter(m => (m.lastSeen || 0) <= 1);
    const inactiveMembers = members.filter(m => (m.lastSeen || 0) > 3);
    const newMembers = members.filter(m => (m.tenure_days || m.tenure || 0) < 7);

    let message = `⚡ **Activity Report for ${clanData.clanName || 'Your Clan'}**\n\n`;
    
    message += `🟢 **Active Members:** ${activeMembers.length}/${members.length}\n`;
    message += `🟡 **Inactive Members:** ${inactiveMembers.length}/${members.length}\n`;
    message += `🆕 **New Members:** ${newMembers.length}/${members.length}\n\n`;

    if (inactiveMembers.length > 0) {
      message += `⚠️ **Inactive Members (>3 days):**\n`;
      inactiveMembers.slice(0, 5).forEach(member => {
        message += `• **${member.name}** - Last seen ${member.lastSeen} days ago\n`;
      });
    }

    if (newMembers.length > 0) {
      message += `\n🆕 **New Members (<7 days):**\n`;
      newMembers.forEach(member => {
        message += `• **${member.name}** - Joined ${member.tenure_days || member.tenure} days ago\n`;
      });
    }

    return message;
  };

  const generateExhibitMessage = (): string => {
    switch (selectedExhibit) {
      case "rushed":
        return generateRushedExhibit();
      case "donations":
        return generateDonationExhibit();
      case "activity":
        return generateActivityExhibit();
      default:
        return "";
    }
  };

  const publishToDiscord = async () => {
    if (!webhookUrl) {
      alert("Please configure your Discord webhook URL first!");
      return;
    }

    const message = generateExhibitMessage();
    if (!message) {
      alert("No data available to generate exhibit!");
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/discord/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          message,
          exhibitType: selectedExhibit,
          clanTag
        })
      });

      if (response.ok) {
        alert("Exhibit published to Discord successfully!");
      } else {
        const error = await response.text();
        alert(`Failed to publish: ${error}`);
      }
    } catch (error) {
      console.error('Discord publish error:', error);
      alert("Failed to publish to Discord. Please check your webhook URL.");
    } finally {
      setIsPublishing(false);
    }
  };

  const updatePreview = () => {
    setPreviewMessage(generateExhibitMessage());
  };

  if (!clanData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Load clan data to access Discord publishing features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Discord Publisher</h2>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Configure Discord webhook"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-3">Discord Webhook Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => saveWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-600">
              💡 Get your webhook URL from Discord Server Settings → Integrations → Webhooks
            </p>
          </div>
        </div>
      )}

      {/* Exhibit Selection */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Select Exhibit to Publish</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => { setSelectedExhibit("rushed"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "rushed" 
                ? "border-red-500 bg-red-50 text-red-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Rush Analysis</div>
            <div className="text-sm opacity-75">Identify rushed players</div>
          </button>
          
          <button
            onClick={() => { setSelectedExhibit("donations"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "donations" 
                ? "border-green-500 bg-green-50 text-green-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <Users className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Donation Report</div>
            <div className="text-sm opacity-75">Top & low donators</div>
          </button>
          
          <button
            onClick={() => { setSelectedExhibit("activity"); updatePreview(); }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedExhibit === "activity" 
                ? "border-blue-500 bg-blue-50 text-blue-700" 
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2" />
            <div className="font-medium">Activity Report</div>
            <div className="text-sm opacity-75">Member activity status</div>
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewMessage && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Preview</h3>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
            {previewMessage}
          </div>
        </div>
      )}

      {/* Publish Button */}
      <div className="flex justify-end">
        <button
          onClick={publishToDiscord}
          disabled={!webhookUrl || !previewMessage || isPublishing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          {isPublishing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Publishing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Publish to Discord
            </>
          )}
        </button>
      </div>
    </div>
  );
}
