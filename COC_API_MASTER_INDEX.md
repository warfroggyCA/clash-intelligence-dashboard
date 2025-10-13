# 📚 Clash of Clans API - Master Documentation Index

> **Complete reference package documenting EVERY data point available in the CoC API**

---

## 🎯 What You Have Here

A comprehensive 3-file documentation package containing:
- **11,479 lines** of documentation and examples
- **440 KB** of data
- **36 API endpoints** fully documented
- **Real API responses** from your actual clan
- **Every single field** that CoC API can return

---

## 📖 The Three Files

### 1️⃣ **COC_API_COMPLETE_REFERENCE.json** (36 KB, 1,047 lines)
**Purpose:** Technical API documentation

**Contains:**
- ✅ All 36 API endpoints with full documentation
- ✅ Every query parameter and response field
- ✅ Request/response structure for each endpoint
- ✅ Authentication and rate limiting details
- ✅ Best practices for caching and error handling
- ✅ Pagination strategies
- ✅ Common use cases and data aggregations
- ✅ Game data reference (troops, heroes, leagues, etc.)

**Use this when:**
- Building API integrations
- Understanding endpoint capabilities
- Planning data architecture
- Implementing caching strategies

---

### 2️⃣ **COC_API_REAL_DATA_EXAMPLES.json** (332 KB, 9,823 lines)
**Purpose:** Real-world API response examples

**Contains:**
- ✅ **ACTUAL** API responses from Criterium clan (#2PR8R8V8P)
- ✅ **REAL** player data (DoubleD and others)
- ✅ Current war data structure
- ✅ War log with 100+ wars
- ✅ CWL group data
- ✅ All leagues, locations, and labels
- ✅ Every field populated with real values

**Examples included:**
1. `clan_full_details` - Complete clan profile (22 KB)
2. `player_full_profile` - Full player profile (19 KB)
3. `current_war` - Current war state
4. `war_log` - 100+ war history entries (117 KB)
5. `cwl_group` - Clan War League group data (13 KB)
6. `leagues_list` - All 29 trophy leagues
7. `war_leagues_list` - All 19 war leagues
8. `capital_leagues_list` - All 23 capital leagues
9. `builder_leagues_list` - All 31 builder leagues
10. `locations_list` - 260+ countries/regions (18 KB)
11. `clan_labels` - All 56 clan labels
12. `player_labels` - All 43 player labels

**Use this when:**
- Seeing what real responses look like
- Understanding nested data structures
- Writing data parsers
- Testing with realistic data

---

### 3️⃣ **COC_API_QUICK_REFERENCE.md** (18 KB, 609 lines)
**Purpose:** Quick lookup and copy-paste commands

**Contains:**
- ✅ Copy-paste ready curl commands
- ✅ Complete list of ALL data points by category
- ✅ Advanced jq queries for filtering data
- ✅ League progression charts
- ✅ Tag formatting rules
- ✅ Error code reference
- ✅ Common data aggregations
- ✅ Quick command examples

**Sections:**
1. Quick Start Commands
2. Clan Data (50+ fields)
3. Player Data (100+ fields)
4. War Data (40+ fields)
5. CWL Data (20+ fields)
6. Capital Raid Data (30+ fields)
7. War Log Data
8. Leagues & Rankings
9. Locations & Rankings
10. Labels
11. Advanced Queries
12. Complete Endpoint List

**Use this when:**
- Need a quick command
- Looking up specific field names
- Testing API calls
- Reference during development

---

## 🚀 Quick Start

### Step 1: Understand the API
Read: `COC_API_QUICK_REFERENCE.md` (start here!)

### Step 2: See Real Data
Open: `COC_API_REAL_DATA_EXAMPLES.json` in your editor

### Step 3: Build Your Integration
Reference: `COC_API_COMPLETE_REFERENCE.json` for technical details

---

## 📊 What Data is Available?

### 🏰 Clan Data (via `/clans/{tag}`)
```
Basic: tag, name, type, description, level, points, members (15 fields)
War Stats: wins, losses, ties, streak, frequency, league (10 fields)
Location: country, region, codes (4 fields)
Capital: hall level, districts (5 fields)
Members: Full roster with 15 fields per member
Badges & Labels: URLs and icons
Language: chat language settings
```
**Total: ~50 top-level fields + member arrays**

### 👤 Player Data (via `/players/{tag}`)
```
Basic: tag, name, level, trophies, TH level, BH level (20 fields)
Clan Info: clan, role, donations (10 fields)
Leagues: trophy, builder, legend stats (15 fields)
Troops: All troops with levels (50+ items)
Heroes: All heroes with levels & equipment (10+ items)
Hero Equipment: All equipment unlocked (20+ items)
Spells: All spells with levels (15+ items)
Achievements: All 60+ achievements
Player House: Decorations
Labels: Player tags
```
**Total: 100+ fields + arrays of troops/heroes/achievements**

### ⚔️ War Data (via `/clans/{tag}/currentwar`)
```
Status: state, team size, times (8 fields)
Clan Stats: attacks, stars, destruction (6 fields)
Roster: All war members with positions (10+ fields each)
Attacks: Complete attack log (7 fields per attack)
Opponent: Full opponent mirror data
```
**Total: 40+ fields + member/attack arrays**

### 🏆 CWL Data (via `/clans/{tag}/currentwar/leaguegroup`)
```
Group: state, season, 8 clans (5 fields)
Clans: Full clan info + 15 registered players each
Rounds: 7 rounds with war tags
```
**Total: 20+ fields + nested clan/player arrays**

### 🏛️ Capital Raid Data (via `/clans/{tag}/capitalraidseasons`)
```
Weekend: state, times, loot, medals (15 fields)
Members: Participation stats (10 fields per member)
Attack Log: All raids on enemies (detailed per district)
Defense Log: All raids received (detailed per district)
```
**Total: 30+ fields + detailed logs**

### 📜 War Log (via `/clans/{tag}/warlog`)
```
Per War: result, time, size, attacks (8 fields)
Clan Stats: attacks, stars, destruction, XP (8 fields)
Opponent: Full opponent stats
```
**Can retrieve 100+ historical wars**

### 🎖️ Rankings (via `/locations/{id}/rankings/*`)
```
Clan Rankings: Global & regional
Player Rankings: Trophy & builder
Capital Rankings: Clan capital
```
**Top 200 per category, updated hourly**

---

## 🎯 Complete Endpoint Coverage

| Category | Endpoints | Data Points |
|----------|-----------|-------------|
| **Clans** | 7 endpoints | 50+ fields |
| **Players** | 2 endpoints | 100+ fields |
| **Wars** | 3 endpoints | 40+ fields |
| **Leagues** | 11 endpoints | All league data |
| **Locations** | 7 endpoints | 260+ locations |
| **Labels** | 2 endpoints | 99 labels |
| **Rankings** | 5 endpoints | Top 200 each |
| **Gold Pass** | 1 endpoint | Season info |

**Total: 36 endpoints covering ALL aspects of Clash of Clans**

---

## 🔍 How to Find Specific Data

### "Where can I get X?"

| What You Want | Endpoint | Field Path |
|---------------|----------|------------|
| Clan trophy count | `/clans/{tag}` | `.clanPoints` |
| Player donations | `/clans/{tag}` or `/players/{tag}` | `.donations` |
| War win rate | `/clans/{tag}` | Calculate from `.warWins`, `.warLosses` |
| Current war attacks | `/clans/{tag}/currentwar` | `.clan.members[].attacks[]` |
| Hero levels | `/players/{tag}` | `.heroes[]` |
| Troop levels | `/players/{tag}` | `.troops[]` |
| Capital contributions | `/players/{tag}` | `.clanCapitalContributions` |
| Raid weekend medals | `/clans/{tag}/capitalraidseasons` | `.offensiveReward`, `.defensiveReward` |
| CWL league | `/clans/{tag}` | `.warLeague.name` |
| Member roles | `/clans/{tag}` | `.memberList[].role` |
| War preference | `/players/{tag}` | `.warPreference` |
| Achievement progress | `/players/{tag}` | `.achievements[]` |
| Legend rank | `/players/{tag}` | `.legendStatistics.currentSeason.rank` |
| Clan war log | `/clans/{tag}/warlog` | `.items[]` |
| Global rankings | `/locations/32000000/rankings/*` | `.items[]` |

---

## 💡 Common Use Cases

### 1. Clan Management Dashboard
**Endpoints needed:**
- `/clans/{tag}` - Basic clan info + member list
- `/clans/{tag}/currentwar` - Current war status
- `/clans/{tag}/capitalraidseasons?limit=1` - Latest raid

**Key metrics:**
- Member donations (sort by `.memberList[].donations`)
- Average trophies (calculate from member array)
- War participation (compare war roster to member list)
- Capital contributions (from player profiles)

### 2. War Stats Tracker
**Endpoints needed:**
- `/clans/{tag}/currentwar` - Live war tracking
- `/clans/{tag}/warlog` - Historical performance
- `/clans/{tag}/currentwar/leaguegroup` - CWL tracking

**Key metrics:**
- Win rate over time
- Stars per attack average
- Destruction percentage trends
- Individual player war performance

### 3. Player Progress Monitor
**Endpoints needed:**
- `/players/{tag}` - Complete player profile

**Key metrics:**
- Town Hall progress (hero/troop levels vs max)
- Trophy progression (current vs best)
- Achievement completion
- Donation ratio (donated vs received)

### 4. Recruitment Tool
**Endpoints needed:**
- `/clans` - Search for clans
- `/players/{tag}` - Verify player stats

**Key filters:**
- Trophy requirements
- War participation
- Donation activity
- Clan Games participation (via achievements)

---

## 🎮 Game Data Reference

### Town Hall Levels
- **Home Village:** 1-16 (TH12+ has weapon levels 1-5)
- **Builder Hall:** 1-10
- **Capital Hall:** 1-10

### Troop Categories
- **Home Village Elixir:** 17 troops (Barbarian → Root Rider)
- **Home Village Dark:** 9 troops (Minion → Headhunter)
- **Super Troops:** 15 temporary boosted troops
- **Siege Machines:** 7 machines (Wall Wrecker → Battle Drill)
- **Builder Base:** 12 troops (Raged Barbarian → Electrofire Wizard)

### Heroes & Equipment
- **Barbarian King:** 2 equipment slots, max level 95 at TH16
- **Archer Queen:** 2 equipment slots, max level 95 at TH16
- **Grand Warden:** 2 equipment slots, max level 70 at TH16, Air/Ground modes
- **Royal Champion:** 2 equipment slots, max level 45 at TH16
- **Battle Machine:** Builder base hero, max level 35
- **Total Equipment:** 20+ unique equipment pieces

### Spells
- **Home Village Elixir:** 9 spells (Lightning → Overgrowth)
- **Home Village Dark:** 5 spells (Poison → Bat)

### Achievements
- **Total:** 60+ achievements
- **Categories:** Progress, Army, War, Builder Base, Capital, Special
- **Stars:** 0-3 per achievement

### League Systems
- **Trophy Leagues:** 23 leagues (Unranked → Legend)
- **War Leagues:** 19 tiers (Unranked → Champion I)
- **Builder Leagues:** 31 tiers (Wood → Titan I)
- **Capital Leagues:** 23 tiers (Unranked → Champion I)

---

## 🛠️ API Technical Details

### Authentication
```bash
Authorization: Bearer {JWT_TOKEN}
```
- Get token from [developer.clashofclans.com](https://developer.clashofclans.com)
- Must whitelist IP addresses
- Tokens never expire but tied to IPs

### Rate Limiting
- **Tier:** Developer Silver (standard)
- **Strategy:** Token bucket per IP/key
- **Typical limit:** ~10-30 requests/second
- **Response:** 429 error when exceeded
- **Solution:** Exponential backoff

### Tag Formatting
- **Format:** `#` + 8-10 characters
- **Characters:** `0289PYLQGRJCUV` only
- **URL encoding:** `#` → `%23` (required!)
- **Example:** `#2PR8R8V8P` → `%232PR8R8V8P`

### Caching Recommendations
| Data Type | Cache Duration | Reason |
|-----------|----------------|--------|
| Player profile | 5-15 min | Updates slowly |
| Clan info | 5-15 min | Updates slowly |
| War data | 1-5 min | Updates frequently |
| War log | 1 hour | Only changes after wars |
| Rankings | 1-6 hours | Updated periodically |
| Static data | 24 hours | Rarely changes |
| Leagues/labels | 30 days | Almost never changes |

### Error Codes
- **400:** Bad request (check tag format/encoding)
- **403:** Access denied (check API key or IP whitelist)
- **404:** Resource not found (invalid tag or doesn't exist)
- **429:** Rate limit exceeded (implement backoff)
- **500:** Server error (retry with backoff)
- **503:** Maintenance (wait and retry)

---

## 📋 Data Update Frequency

| Data | Update Speed |
|------|--------------|
| Trophies | Real-time |
| Donations | Real-time |
| War attacks | 1-2 minute delay |
| War log | After war ends |
| Clan Games | Real-time during event |
| Capital raids | Real-time during weekend |
| Rankings | Hourly updates |
| Legend rankings | Daily at season end |
| Player profile | Immediate |
| Hero/troop levels | Immediate |

---

## 🎁 Bonus: Sample Queries

### Get clan's top 10 donors
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.memberList | sort_by(-.donations) | .[0:9] | .[] | {name, donations, role}'
```

### Check war participation rate
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/currentwar" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '{
      totalMembers: .clan.members | length,
      attacked: [.clan.members[] | select(.attacks != null)] | length,
      participationRate: (([.clan.members[] | select(.attacks != null)] | length) / (.clan.members | length) * 100)
    }'
```

### Track hero progress
```bash
curl -s "https://api.clashofclans.com/v1/players/%23VGQVRLRL" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.heroes[] | {
      name, 
      level, 
      maxLevel, 
      progress: (.level / .maxLevel * 100 | floor)
    }'
```

### Get capital raid summary
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/capitalraidseasons?limit=1" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.items[0] | {
      totalLoot: .capitalTotalLoot,
      totalMedals: (.offensiveReward + .defensiveReward),
      raiders: .members | length,
      avgLootPerRaider: (.capitalTotalLoot / (.members | length) | floor)
    }'
```

---

## 📚 Documentation Package Summary

### What's Included
✅ Complete API endpoint documentation (36 endpoints)  
✅ Real API responses from your clan (332 KB of examples)  
✅ Every available data field documented  
✅ Copy-paste ready commands  
✅ Advanced query examples  
✅ Best practices and caching strategies  
✅ Game data reference (troops, heroes, leagues)  
✅ Error handling guide  
✅ Rate limiting strategies  

### Coverage Stats
- **11,479 lines** of documentation
- **440 KB** of reference material
- **36 API endpoints** fully documented
- **50+ clan fields** documented
- **100+ player fields** documented
- **60+ achievements** listed
- **17 home village troops** + 9 dark troops + 15 super troops
- **4 heroes** with 20+ equipment pieces
- **29 trophy leagues** documented
- **260+ locations** in examples
- **99 labels** (56 clan + 43 player)

### Files at a Glance
```
COC_API_COMPLETE_REFERENCE.json    36 KB   Technical documentation
COC_API_REAL_DATA_EXAMPLES.json   332 KB   Real API responses
COC_API_QUICK_REFERENCE.md         18 KB   Quick lookup guide
COC_API_MASTER_INDEX.md             X KB   This file (overview)
```

---

## 🚀 Next Steps

1. **Start with Quick Reference** → `COC_API_QUICK_REFERENCE.md`
2. **Explore Real Data** → `COC_API_REAL_DATA_EXAMPLES.json`
3. **Build Integration** → Use `COC_API_COMPLETE_REFERENCE.json`
4. **Test Your Queries** → Copy commands from Quick Reference
5. **Deep Dive** → Read full endpoint docs in Complete Reference

---

## 💪 You Now Have Access To

✅ **Every single data point** the Clash of Clans API can provide  
✅ **Real-world examples** from your actual clan  
✅ **Complete documentation** of all 36 endpoints  
✅ **Copy-paste commands** for immediate testing  
✅ **Best practices** for production use  

**Everything you need to build ANY CoC-related tool or dashboard!** 🎮

---

*Documentation Package Created: January 26, 2025*  
*API Version: v1*  
*Base URL: https://api.clashofclans.com/v1*  
*Clan: Criterium (#2PR8R8V8P)*  
*Sample Player: DoubleD (#VGQVRLRL)*



