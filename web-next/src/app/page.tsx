/**
 * Clash Intelligence Dashboard - Main Page
 * 
 * Redirects to /simple-roster (the new clean roster view)
 * 
 * Version: 2.0.0 (Simplified Architecture)
 * Last Updated: October 2025
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/simple-roster');
}

// =============================================================================
// BEAUTIFUL PLACEHOLDER COMPONENTS
// =============================================================================

const EventsDashboard = () => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
    <div className="container mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-6 shadow-2xl">
          <span className="text-4xl">📊</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Events Dashboard
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Track significant player events, milestones, and clan activities with beautiful analytics
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🏆</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Trophy Milestones</h3>
            <p className="text-gray-600">Track major trophy achievements and climbing progress</p>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💝</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Donation Records</h3>
            <p className="text-gray-600">Monitor donation milestones and clan generosity</p>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚔️</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">War Events</h3>
            <p className="text-gray-600">Capture war participation and performance highlights</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ApplicantsDashboard = () => (
  <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
    <div className="container mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-6 shadow-2xl">
          <span className="text-4xl">🎯</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-4">
          Applicant Evaluation
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Comprehensive scoring system for evaluating potential clan members with AI-powered insights
        </p>
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">Evaluation Criteria</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">1</span>
                  </div>
                  <span className="text-gray-700">Town Hall Level Assessment</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">2</span>
                  </div>
                  <span className="text-gray-700">Hero Development Analysis</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">3</span>
                  </div>
                  <span className="text-gray-700">Activity & Engagement Score</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">4</span>
                  </div>
                  <span className="text-gray-700">War Performance History</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
              <h4 className="text-lg font-semibold text-emerald-800 mb-3">AI-Powered Insights</h4>
              <p className="text-emerald-700 text-sm leading-relaxed">
                Our advanced evaluation system combines multiple data points to provide 
                comprehensive applicant scoring with detailed recommendations for clan leadership.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default async function HomePage() {
  const initialClanTag = cfg.homeClanTag;
  let initialRoster: Roster | null = null;

  // Safe mode: render a minimal shell to isolate render loops in production
  if (process.env.NEXT_PUBLIC_SAFE_MODE === 'true') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-center space-y-2">
          <div className="text-4xl">🛟</div>
          <p className="text-lg font-semibold">Dashboard Safe Mode</p>
          <p className="text-sm text-slate-300">Core UI temporarily disabled for diagnostics.</p>
        </div>
      </div>
    );
  }

  try {
    initialRoster = await buildRosterSnapshotFirst(initialClanTag, 'latest');
  } catch (error) {
    console.error('[Page] Failed to build initial roster:', error);
  }

  return (
    <ClientAppShellNoSSR initialRoster={initialRoster} initialClanTag={initialClanTag} />
  );
}
