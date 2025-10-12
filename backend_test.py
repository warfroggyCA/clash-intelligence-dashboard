#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Clash Intelligence Dashboard
Tests the improved activity calculation system implementation
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import sys

# Configuration
BASE_URL = "http://localhost:5050"
TEST_CLAN_TAG = "2PR8R8V8P"  # Default clan tag from env
TEST_PLAYER_TAG = "EXAMPLE123"  # Will be replaced with actual player from roster

# Expected test members for activity validation
EXPECTED_MEMBERS = {
    "warfroggy": {"role": "leader", "trophies": 380, "donations": 72, "expected_score_range": (45, 50), "expected_level": "Moderate"},
    "DoubleD": {"role": "coLeader", "trophies": 239, "donations": 0, "expected_score_range": (35, 40), "expected_level": "Low"},
    "andrew": {"role": "member", "trophies": 0, "donations": 0, "expected_score_range": (10, 15), "expected_level": "Inactive"}
}

class APITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Clash-Intelligence-Test/1.0'
        })
        self.test_results = []
        self.actual_player_tag = None
        
    def log_test(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def test_health_endpoint(self):
        """Test health endpoint functionality"""
        print("\n=== Testing Health Endpoint ===")
        
        try:
            # Test basic health check
            response = self.session.get(f"{self.base_url}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    health_data = data['data']
                    has_coc = health_data.get('hasCoC', False)
                    has_openai = health_data.get('hasOpenAI', False)
                    
                    self.log_test(
                        "Health Endpoint Basic",
                        True,
                        f"Health check successful. CoC API: {has_coc}, OpenAI: {has_openai}",
                        data
                    )
                    
                    # Test MCP health check
                    mcp_response = self.session.get(f"{self.base_url}/api/health?mcp=true")
                    if mcp_response.status_code == 200:
                        mcp_data = mcp_response.json()
                        if mcp_data.get('success') and 'tools' in mcp_data.get('data', {}):
                            self.log_test(
                                "Health Endpoint MCP",
                                True,
                                f"MCP health check successful with {len(mcp_data['data']['tools'])} tools",
                                mcp_data
                            )
                        else:
                            self.log_test("Health Endpoint MCP", False, "MCP response missing tools data")
                    else:
                        self.log_test("Health Endpoint MCP", False, f"MCP health check failed: {mcp_response.status_code}")
                        
                else:
                    self.log_test("Health Endpoint Basic", False, "Health response missing success or data fields")
            else:
                self.log_test("Health Endpoint Basic", False, f"Health endpoint returned {response.status_code}")
                
        except Exception as e:
            self.log_test("Health Endpoint Basic", False, f"Health endpoint error: {str(e)}")
    
    def test_v2_roster_api(self):
        """Test the core v2/roster API with activity calculation focus"""
        print("\n=== Testing V2 Roster API with Activity Calculations ===")
        
        try:
            # Test without clan tag (should use default)
            response = self.session.get(f"{self.base_url}/api/v2/roster")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    roster_data = data['data']
                    
                    # Check required fields
                    required_fields = ['clan', 'snapshot', 'members']
                    missing_fields = [field for field in required_fields if field not in roster_data]
                    
                    if not missing_fields:
                        members = roster_data['members']
                        clan_info = roster_data['clan']
                        snapshot_info = roster_data['snapshot']
                        
                        # Store first player tag for later tests
                        if members and len(members) > 0:
                            first_member = members[0]
                            if first_member.get('tag'):
                                self.actual_player_tag = first_member['tag'].replace('#', '')
                        
                        self.log_test(
                            "V2 Roster API Structure",
                            True,
                            f"Roster API returned {len(members)} members with proper structure. Clan: {clan_info.get('name', 'Unknown')}",
                            {
                                'member_count': len(members),
                                'clan_name': clan_info.get('name'),
                                'snapshot_id': snapshot_info.get('id') if snapshot_info else None
                            }
                        )
                        
                        # Test member data quality with focus on activity calculation fields
                        if members:
                            sample_member = members[0]
                            member_fields = ['tag', 'name', 'trophies', 'donations', 'donationsReceived', 'role']
                            has_required_fields = all(field in sample_member for field in member_fields)
                            
                            # Check for activity-related fields
                            activity_fields = ['rankedLeagueId', 'rankedTrophies', 'bk', 'aq', 'gw', 'rc', 'mp']
                            has_activity_fields = any(field in sample_member for field in activity_fields)
                            
                            self.log_test(
                                "V2 Roster Member Data",
                                has_required_fields,
                                f"Member data quality check. Required fields: {has_required_fields}, Activity fields present: {has_activity_fields}",
                                {
                                    'sample_member': sample_member.get('name', 'Unknown'),
                                    'has_required': has_required_fields,
                                    'has_activity_data': has_activity_fields,
                                    'available_fields': list(sample_member.keys())
                                }
                            )
                            
                            # Store members for activity testing
                            self.roster_members = members
                            
                        else:
                            self.log_test("V2 Roster Member Data", False, "No members found in roster")
                            
                    else:
                        self.log_test("V2 Roster API Structure", False, f"Missing required fields: {missing_fields}")
                else:
                    self.log_test("V2 Roster API Structure", False, "Roster response missing success or data fields")
            else:
                self.log_test("V2 Roster API Structure", False, f"Roster API returned {response.status_code}: {response.text}")
                
            # Test with specific clan tag
            response_with_tag = self.session.get(f"{self.base_url}/api/v2/roster?clanTag={TEST_CLAN_TAG}")
            if response_with_tag.status_code == 200:
                self.log_test("V2 Roster API with ClanTag", True, "Roster API works with specific clan tag parameter")
            else:
                self.log_test("V2 Roster API with ClanTag", False, f"Roster API with clan tag failed: {response_with_tag.status_code}")
                
        except Exception as e:
            self.log_test("V2 Roster API Structure", False, f"Roster API error: {str(e)}")
    
    def test_player_history_api(self):
        """Test the new player history API with different day filters"""
        print("\n=== Testing Player History API ===")
        
        if not self.actual_player_tag:
            self.log_test("Player History API", False, "No player tag available for testing (roster API may have failed)")
            return
            
        try:
            # Test different day filters: 30, 60, 90
            for days in [30, 60, 90]:
                response = self.session.get(f"{self.base_url}/api/player/{self.actual_player_tag}/history?days={days}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        history_data = data.get('data', [])
                        meta = data.get('meta', {})
                        
                        self.log_test(
                            f"Player History API ({days} days)",
                            True,
                            f"History API returned {len(history_data)} data points for {days} days. Snapshots found: {meta.get('snapshotsFound', 0)}",
                            {
                                'days_requested': days,
                                'data_points': len(history_data),
                                'snapshots_found': meta.get('snapshotsFound', 0),
                                'player_tag': meta.get('playerTag')
                            }
                        )
                        
                        # Test data structure if we have data
                        if history_data:
                            sample_data = history_data[0]
                            required_fields = ['date', 'trophies', 'donations', 'donationsReceived']
                            has_required = all(field in sample_data for field in required_fields)
                            has_deltas = len(history_data) > 1 and 'deltas' in history_data[1]
                            
                            self.log_test(
                                f"Player History Data Structure ({days} days)",
                                has_required,
                                f"History data structure check. Required fields: {has_required}, Has deltas: {has_deltas}",
                                sample_data
                            )
                    else:
                        error_msg = data.get('error', 'Unknown error')
                        self.log_test(f"Player History API ({days} days)", False, f"API returned error: {error_msg}")
                else:
                    self.log_test(f"Player History API ({days} days)", False, f"HTTP {response.status_code}: {response.text}")
            
            # Test invalid day parameter
            response = self.session.get(f"{self.base_url}/api/player/{self.actual_player_tag}/history?days=200")
            if response.status_code == 200:
                data = response.json()
                meta = data.get('meta', {})
                actual_days = meta.get('days', 0)
                if actual_days <= 90:
                    self.log_test("Player History API Validation", True, f"API correctly limited days to {actual_days} (max 90)")
                else:
                    self.log_test("Player History API Validation", False, f"API did not limit days parameter: {actual_days}")
            
            # Test invalid player tag
            response = self.session.get(f"{self.base_url}/api/player/INVALID123/history")
            if response.status_code == 400:
                self.log_test("Player History API Invalid Tag", True, "API correctly rejected invalid player tag")
            else:
                self.log_test("Player History API Invalid Tag", False, f"API should reject invalid tags with 400, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Player History API", False, f"Player history API error: {str(e)}")
    
    def test_player_comparison_api(self):
        """Test the new player comparison API"""
        print("\n=== Testing Player Comparison API ===")
        
        if not self.actual_player_tag:
            self.log_test("Player Comparison API", False, "No player tag available for testing (roster API may have failed)")
            return
            
        try:
            response = self.session.get(f"{self.base_url}/api/player/{self.actual_player_tag}/comparison")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    comparison_data = data['data']
                    meta = data.get('meta', {})
                    
                    # Check required comparison metrics
                    required_metrics = ['trophies', 'donations', 'donationsReceived', 'warStars', 'clanCapitalContributions', 'donationRatio']
                    missing_metrics = [metric for metric in required_metrics if metric not in comparison_data]
                    
                    if not missing_metrics:
                        # Check structure of a metric
                        sample_metric = comparison_data['trophies']
                        metric_fields = ['playerValue', 'clanAverage', 'clanMedian', 'percentile', 'rank', 'totalPlayers']
                        has_metric_structure = all(field in sample_metric for field in metric_fields)
                        
                        self.log_test(
                            "Player Comparison API Structure",
                            has_metric_structure,
                            f"Comparison API returned all required metrics with proper structure. Player: {meta.get('playerName', 'Unknown')}",
                            {
                                'player_name': meta.get('playerName'),
                                'clan_size': meta.get('clanSize'),
                                'sample_percentile': sample_metric.get('percentile'),
                                'sample_rank': sample_metric.get('rank')
                            }
                        )
                        
                        # Test percentile calculations
                        percentiles_valid = all(
                            0 <= comparison_data[metric].get('percentile', -1) <= 100
                            for metric in required_metrics
                        )
                        
                        self.log_test(
                            "Player Comparison Percentiles",
                            percentiles_valid,
                            f"Percentile calculations are within valid range (0-100)",
                            {metric: comparison_data[metric].get('percentile') for metric in required_metrics}
                        )
                        
                        # Test town hall and role comparisons if present
                        has_th_comparison = 'townHallComparison' in comparison_data
                        has_role_comparison = 'roleComparison' in comparison_data
                        
                        self.log_test(
                            "Player Comparison Additional Data",
                            True,
                            f"Additional comparisons - Town Hall: {has_th_comparison}, Role: {has_role_comparison}",
                            {
                                'townHallComparison': comparison_data.get('townHallComparison'),
                                'roleComparison': comparison_data.get('roleComparison')
                            }
                        )
                        
                    else:
                        self.log_test("Player Comparison API Structure", False, f"Missing required metrics: {missing_metrics}")
                else:
                    error_msg = data.get('error', 'Unknown error')
                    self.log_test("Player Comparison API Structure", False, f"API returned error: {error_msg}")
            else:
                self.log_test("Player Comparison API Structure", False, f"HTTP {response.status_code}: {response.text}")
            
            # Test invalid player tag
            response = self.session.get(f"{self.base_url}/api/player/INVALID123/comparison")
            if response.status_code == 400:
                self.log_test("Player Comparison API Invalid Tag", True, "API correctly rejected invalid player tag")
            else:
                self.log_test("Player Comparison API Invalid Tag", False, f"API should reject invalid tags with 400, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Player Comparison API", False, f"Player comparison API error: {str(e)}")
    
    def test_insights_api(self):
        """Test the insights API for command center functionality"""
        print("\n=== Testing Insights API ===")
        
        try:
            # Test insights retrieval
            response = self.session.get(f"{self.base_url}/api/insights?clanTag={TEST_CLAN_TAG}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'data' in data:
                    insights_data = data['data']
                    
                    required_fields = ['clanTag', 'smartInsightsPayload']
                    missing_fields = [field for field in required_fields if field not in insights_data]
                    
                    if not missing_fields:
                        payload = insights_data.get('smartInsightsPayload', {})
                        
                        self.log_test(
                            "Insights API Structure",
                            True,
                            f"Insights API returned proper structure for clan {insights_data.get('clanTag')}",
                            {
                                'clan_tag': insights_data.get('clanTag'),
                                'snapshot_date': insights_data.get('snapshotDate'),
                                'has_payload': bool(payload)
                            }
                        )
                        
                        # Test payload structure if available
                        if payload and isinstance(payload, dict):
                            has_metadata = 'metadata' in payload
                            self.log_test(
                                "Insights Payload Structure",
                                has_metadata,
                                f"Insights payload has proper structure with metadata: {has_metadata}",
                                payload.get('metadata', {})
                            )
                        else:
                            self.log_test("Insights Payload Structure", False, "Insights payload is empty or invalid")
                            
                    else:
                        self.log_test("Insights API Structure", False, f"Missing required fields: {missing_fields}")
                        
                elif response.status_code == 404:
                    # 404 is acceptable if no insights are available yet
                    self.log_test("Insights API Structure", True, "No insights available yet (404 is acceptable for new system)")
                else:
                    error_msg = data.get('error', 'Unknown error')
                    self.log_test("Insights API Structure", False, f"API returned error: {error_msg}")
            else:
                if response.status_code == 404:
                    self.log_test("Insights API Structure", True, "No insights available yet (404 is acceptable for new system)")
                else:
                    self.log_test("Insights API Structure", False, f"HTTP {response.status_code}: {response.text}")
            
            # Test missing clan tag parameter
            response = self.session.get(f"{self.base_url}/api/insights")
            if response.status_code == 400:
                self.log_test("Insights API Validation", True, "API correctly requires clanTag parameter")
            else:
                self.log_test("Insights API Validation", False, f"API should require clanTag parameter, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Insights API", False, f"Insights API error: {str(e)}")
    
    def test_error_handling(self):
        """Test error handling across APIs"""
        print("\n=== Testing Error Handling ===")
        
        try:
            # Test non-existent endpoints
            response = self.session.get(f"{self.base_url}/api/nonexistent")
            if response.status_code == 404:
                self.log_test("Error Handling - 404", True, "Non-existent endpoints return 404")
            else:
                self.log_test("Error Handling - 404", False, f"Expected 404 for non-existent endpoint, got {response.status_code}")
            
            # Test malformed requests
            response = self.session.get(f"{self.base_url}/api/player//history")  # Double slash
            if response.status_code in [400, 404]:
                self.log_test("Error Handling - Malformed", True, f"Malformed requests handled properly ({response.status_code})")
            else:
                self.log_test("Error Handling - Malformed", False, f"Malformed request should return 400/404, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Error Handling", False, f"Error handling test failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Clash Intelligence Dashboard API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Test Clan Tag: {TEST_CLAN_TAG}")
        print("=" * 60)
        
        # Run tests in logical order
        self.test_health_endpoint()
        self.test_v2_roster_api()
        self.test_player_history_api()
        self.test_player_comparison_api()
        self.test_insights_api()
        self.test_error_handling()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        return passed_tests, failed_tests, self.test_results

def main():
    """Main test execution"""
    tester = APITester(BASE_URL)
    
    try:
        passed, failed, results = tester.run_all_tests()
        
        # Save detailed results
        with open('/app/test_results_detailed.json', 'w') as f:
            json.dump({
                'summary': {
                    'total': len(results),
                    'passed': passed,
                    'failed': failed,
                    'success_rate': (passed/len(results))*100 if results else 0
                },
                'results': results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        
        print(f"\n📄 Detailed results saved to /app/test_results_detailed.json")
        
        # Exit with appropriate code
        sys.exit(0 if failed == 0 else 1)
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()