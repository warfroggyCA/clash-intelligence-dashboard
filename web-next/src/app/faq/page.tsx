import Image from 'next/image';
import Link from 'next/link';

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image 
                src="https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXhoIjoic3VwZXJjZWxsXC9maWxlXC91OGFIS25ZUkpQaXlvVHh5a1Q0OC5wbmcifQ:supercell:8_pSWOLovwldaAWJu_t2Q6C91k6oc7p_mY0m9yar7G0?width=1218&format=webp&quality=100"
                alt="Clash of Clans Logo"
                width={180}
                height={64}
                className="h-16 w-auto object-contain"
                priority
              />
              <div>
                <h1 className="text-3xl font-bold">Clash Intelligence Dashboard</h1>
                <p className="text-indigo-200">Frequently Asked Questions</p>
              </div>
            </div>
            <Link 
              href="/"
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">📚 Complete Guide</h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about managing your clan with data-driven insights
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">📋 Table of Contents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <a href="#what-is-this" className="text-blue-700 hover:text-blue-900 hover:underline">1. What is this dashboard?</a>
              <a href="#how-it-works" className="text-blue-700 hover:text-blue-900 hover:underline">2. How does it work?</a>
              <a href="#what-tracks" className="text-blue-700 hover:text-blue-900 hover:underline">3. What data is tracked?</a>
              <a href="#why-important" className="text-blue-700 hover:text-blue-900 hover:underline">4. Why is this data important?</a>
              <a href="#key-metrics" className="text-blue-700 hover:text-blue-900 hover:underline">5. Key metrics explained</a>
              <a href="#daily-tasks" className="text-blue-700 hover:text-blue-900 hover:underline">6. Daily management tasks</a>
              <a href="#war-analytics" className="text-blue-700 hover:text-blue-900 hover:underline">7. War analytics guide</a>
              <a href="#best-practices" className="text-blue-700 hover:text-blue-900 hover:underline">8. Best practices</a>
              <a href="#troubleshooting" className="text-blue-700 hover:text-blue-900 hover:underline">9. Troubleshooting</a>
              <a href="#future-features" className="text-blue-700 hover:text-blue-900 hover:underline">10. Future features</a>
            </div>
          </div>

          {/* FAQ Content */}
          <div className="space-y-8">
            
            {/* What is this dashboard? */}
            <section id="what-is-this" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">🤔 What is this dashboard?</h3>
              <div className="space-y-4 text-gray-700">
                <p>
                  The <strong>Clash Intelligence Dashboard</strong> is a comprehensive clan management tool that provides 
                  data-driven insights to help clan leaders make informed decisions. It tracks member activity, 
                  performance metrics, and provides strategic recommendations to improve your clan&apos;s success.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">🎯 Key Benefits:</h4>
                  <ul className="list-disc list-inside space-y-1 text-green-700">
                    <li>Identify inactive members before they become a problem</li>
                    <li>Track donation patterns and balance</li>
                    <li>Analyze war performance and consistency</li>
                    <li>Monitor clan growth and development trends</li>
                    <li>Make data-driven recruitment decisions</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* How does it work? */}
            <section id="how-it-works" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">⚙️ How does it work?</h3>
              <div className="space-y-4 text-gray-700">
                <p>
                  The dashboard connects to the Clash of Clans API to fetch real-time clan data, then processes 
                  and analyzes this information to provide meaningful insights.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">1. Data Collection</h4>
                    <p className="text-blue-700 text-sm">Fetches member data, war history, and clan statistics from the official API</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2">2. Analysis</h4>
                    <p className="text-purple-700 text-sm">Processes data to calculate activity scores, trends, and performance metrics</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">3. Insights</h4>
                    <p className="text-green-700 text-sm">Presents actionable insights and recommendations for clan management</p>
                  </div>
                </div>
              </div>
            </section>

            {/* What data is tracked? */}
            <section id="what-tracks" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">📊 What data is tracked?</h3>
              <div className="space-y-4 text-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">🟢 High Confidence Data (Rock-Solid Signals)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Attack Wins:</strong> Only increases with actual multiplayer attacks</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Versus Battles:</strong> Opt-in battles require active participation</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Capital Contributions:</strong> Requires capital attacks or donations</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Donations Given:</strong> Can&apos;t donate while offline</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Hero Upgrades:</strong> Only happen with active play</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Town Hall Upgrades:</strong> Require active participation</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">🟡 Medium Confidence Data</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-yellow-600 mr-2">⚠</span>
                        <span><strong>Donations Received:</strong> Requires posting requests (strong indicator)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-yellow-600 mr-2">⚠</span>
                        <span><strong>Trophy Changes:</strong> Usually from active play</span>
                      </li>
                    </ul>
                    <h4 className="font-semibold text-gray-900 mb-3 mt-4">🔴 Not Used (Weak Signals)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-red-600 mr-2">✗</span>
                        <span><strong>Defense Wins/Losses:</strong> Happen while offline</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Why is this data important? */}
            <section id="why-important" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">💡 Why is this data important?</h3>
              <div className="space-y-4 text-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">🚨 Problem Detection</h4>
                    <p className="text-red-700 text-sm">Identify inactive members before they hurt clan performance in wars or cause drama</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">📈 Performance Tracking</h4>
                    <p className="text-blue-700 text-sm">Monitor individual and clan-wide improvement over time</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">🎯 Strategic Decisions</h4>
                    <p className="text-green-700 text-sm">Make informed choices about promotions, demotions, and recruitment</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2">⚖️ Fair Management</h4>
                    <p className="text-purple-700 text-sm">Use objective data instead of subjective opinions for clan decisions</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Key metrics explained */}
            <section id="key-metrics" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">📈 Key metrics explained</h3>
              <div className="space-y-6 text-gray-700">
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">🎯 Activity Score</h4>
                  <p className="text-sm mb-2">Based on rock-solid signals that only change when players are actively playing:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Very Active (90-100%):</strong> Multiple signals updated recently</li>
                    <li><strong>Active (70-89%):</strong> Some recent activity indicators</li>
                    <li><strong>Moderate (50-69%):</strong> Limited recent activity</li>
                    <li><strong>Inactive (0-49%):</strong> No recent activity signals</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">💝 Donation Balance</h4>
                  <p className="text-sm mb-2">Net contribution to the clan (Given - Received):</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Positive (Red):</strong> Giving more than receiving - great contributor</li>
                    <li><strong>Zero (Black):</strong> Balanced giver and receiver</li>
                    <li><strong>Negative (Green):</strong> Receiving more than giving - may need support</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">⚔️ War Efficiency Index</h4>
                  <p className="text-sm mb-2">Average stars earned per attack in wars:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Excellent (2.5+):</strong> Consistently high performance</li>
                    <li><strong>Good (2.0-2.4):</strong> Solid war contributor</li>
                    <li><strong>Average (1.5-1.9):</strong> Room for improvement</li>
                    <li><strong>Below Average (&lt;1.5):</strong> Needs strategy training</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">📊 Contribution Consistency</h4>
                  <p className="text-sm mb-2">How steady a player&apos;s performance is over time:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Excellent (80%+):</strong> Very reliable performer</li>
                    <li><strong>Good (60-79%):</strong> Generally consistent</li>
                    <li><strong>Inconsistent (&lt;60%):</strong> High variation, needs support</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">🏠 Rush Percentage</h4>
                  <p className="text-sm mb-2">How rushed a player is relative to their Town Hall level:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>0-20%:</strong> Not rushed - excellent development</li>
                    <li><strong>21-40%:</strong> Slightly rushed - manageable</li>
                    <li><strong>41-60%:</strong> Moderately rushed - needs focus</li>
                    <li><strong>61%+:</strong> Very rushed - major catch-up needed</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Daily management tasks */}
            <section id="daily-tasks" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">📅 Daily management tasks</h3>
              <div className="space-y-4 text-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">🌅 Morning Routine (5 minutes)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">1.</span>
                        <span>Check for new inactive members (red activity scores)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">2.</span>
                        <span>Review donation balances for extreme imbalances</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">3.</span>
                        <span>Check war performance from recent wars</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">🌆 Evening Routine (10 minutes)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-purple-600 mr-2">1.</span>
                        <span>Review clan activity trends in Strategic Intelligence</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-purple-600 mr-2">2.</span>
                        <span>Identify members who need attention or support</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-purple-600 mr-2">3.</span>
                        <span>Plan recruitment based on clan composition gaps</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Weekly Deep Dive (30 minutes)</h4>
                  <ul className="space-y-2 text-sm text-yellow-700">
                    <li>• Analyze war performance trends and identify training needs</li>
                    <li>• Review donation patterns and clan culture</li>
                    <li>• Check for rushed members who need development guidance</li>
                    <li>• Update clan rules or guidelines based on data insights</li>
                    <li>• Plan clan events or challenges based on member activity levels</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* War analytics guide */}
            <section id="war-analytics" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">⚔️ War analytics guide</h3>
              <div className="space-y-4 text-gray-700">
                <p>
                  The war analytics feature provides comprehensive insights into your clan&apos;s war performance 
                  and helps identify areas for improvement.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">🎯 Attack Efficiency Index</h4>
                    <p className="text-red-700 text-sm mb-2">Average stars earned per attack</p>
                    <ul className="text-xs space-y-1">
                      <li>• <strong>2.5+ stars:</strong> Elite attacker - war MVP material</li>
                      <li>• <strong>2.0-2.4 stars:</strong> Solid contributor - reliable in wars</li>
                      <li>• <strong>1.5-1.9 stars:</strong> Needs improvement - consider training</li>
                      <li>• <strong>&lt;1.5 stars:</strong> Major training needed - may need to sit out wars</li>
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-800 mb-2">📊 Contribution Consistency</h4>
                    <p className="text-orange-700 text-sm mb-2">Performance steadiness over time</p>
                    <ul className="text-xs space-y-1">
                      <li>• <strong>80%+:</strong> Very reliable - can count on them</li>
                      <li>• <strong>60-79%:</strong> Generally consistent - good war member</li>
                      <li>• <strong>&lt;60%:</strong> Unpredictable - needs support or training</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Strategic War Insights</h4>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li>• <strong>Top Performers:</strong> Identify your war MVPs for leadership roles</li>
                    <li>• <strong>Improving Trends:</strong> Members showing growth - invest in their development</li>
                    <li>• <strong>Declining Trends:</strong> Members who need attention or may need to sit out</li>
                    <li>• <strong>Cleanup Efficiency:</strong> Who&apos;s good at securing remaining stars on second attempts</li>
                    <li>• <strong>Defensive Hold Rate:</strong> How often bases avoid being 3-starred</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Best practices */}
            <section id="best-practices" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">⭐ Best practices</h3>
              <div className="space-y-4 text-gray-700">
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">✅ Do&apos;s</h4>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li>• Use data to support decisions, but don&apos;t ignore context and member circumstances</li>
                    <li>• Give members a chance to improve before taking action based on low scores</li>
                    <li>• Celebrate improvements and positive trends publicly</li>
                    <li>• Use insights to provide targeted help and training</li>
                    <li>• Regularly review and adjust your clan&apos;s expectations based on data</li>
                    <li>• Share positive metrics with the clan to motivate improvement</li>
                  </ul>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">❌ Don&apos;ts</h4>
                  <ul className="space-y-2 text-sm text-red-700">
                    <li>• Don&apos;t make snap decisions based on single data points</li>
                    <li>• Don&apos;t use data to embarrass or shame members publicly</li>
                    <li>• Don&apos;t ignore personal circumstances (vacation, illness, etc.)</li>
                    <li>• Don&apos;t set unrealistic expectations based on top performers</li>
                    <li>• Don&apos;t forget that this is a game - fun should come first</li>
                    <li>• Don&apos;t rely solely on data - communication and relationships matter</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">🎯 Pro Tips</h4>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li>• Set up regular &quot;data review&quot; sessions with co-leaders</li>
                    <li>• Create clan challenges based on metrics (donation goals, activity streaks)</li>
                    <li>• Use the departure tracking to understand why members leave</li>
                    <li>• Track improvement over time, not just current performance</li>
                    <li>• Combine multiple metrics for a complete picture of each member</li>
                    <li>• Use the mobile view to check on members while away from your computer</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="border-b border-gray-200 pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">🔧 Troubleshooting</h3>
              <div className="space-y-4 text-gray-700">
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">❓ Common Issues</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Q: Why does a member show as inactive when I know they&apos;re playing?</strong>
                      <p className="text-yellow-700 mt-1">A: The activity score is based on specific signals that only change with active play. If they&apos;re only doing single-player content or not engaging in multiplayer activities, they may not trigger these signals.</p>
                    </div>
                    <div>
                      <strong>Q: Why are donation balances sometimes negative?</strong>
                      <p className="text-yellow-700 mt-1">A: This means they&apos;ve received more donations than they&apos;ve given. This is normal for newer members or those upgrading heroes, but should be monitored for long-term patterns.</p>
                    </div>
                    <div>
                      <strong>Q: Why don&apos;t I see war data for some members?</strong>
                      <p className="text-yellow-700 mt-1">A: War analytics use mock data for development. Real war data will be connected when historical war data is available from the API.</p>
                    </div>
                    <div>
                      <strong>Q: The page loads slowly or shows errors</strong>
                      <p className="text-yellow-700 mt-1">A: Try refreshing the page. If issues persist, check your internet connection and try again in a few minutes.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Future features */}
            <section id="future-features" className="pb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">🚀 Future features</h3>
              <div className="space-y-4 text-gray-700">
                <p>We&apos;re constantly working to improve the dashboard. Here&apos;s what&apos;s coming:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2">📊 Real War Data</h4>
                    <p className="text-purple-700 text-sm">Connect to actual historical war data for accurate analytics</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">📱 Mobile App</h4>
                    <p className="text-blue-700 text-sm">Native mobile app for on-the-go clan management</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">🔔 Smart Notifications</h4>
                    <p className="text-green-700 text-sm">Automated alerts for important clan events and trends</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-800 mb-2">📈 Advanced Analytics</h4>
                    <p className="text-orange-700 text-sm">More detailed performance tracking and predictive insights</p>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600 mb-4">
              Need help or have suggestions? The dashboard is designed to make clan management easier and more effective.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
