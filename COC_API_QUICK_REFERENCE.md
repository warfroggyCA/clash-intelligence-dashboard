# Clash of Clans API - Quick Reference Guide

> **Complete documentation of EVERY data point available in the CoC API**

## 📚 Reference Files

This directory contains three comprehensive files:

1. **`COC_API_COMPLETE_REFERENCE.json`** (36 KB)
   - Complete endpoint documentation
   - All available fields and data structures
   - Best practices and rate limiting info
   - Common use cases and caching strategies

2. **`COC_API_REAL_DATA_EXAMPLES.json`** (332 KB)
   - **REAL** API responses from your clan
   - Actual data showing every field populated
   - Use this to see what real responses look like

3. **`COC_API_QUICK_REFERENCE.md`** (this file)
   - Quick lookup guide for common tasks
   - Copy-paste ready curl commands

---

## 🚀 Quick Start Commands

All commands use your API key. Replace `{TAG}` with actual tags.

### Get Clan Information
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

### Get Player Information
```bash
curl -s "https://api.clashofclans.com/v1/players/%23VGQVRLRL" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

### Get Current War
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/currentwar" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

### Get War Log
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/warlog" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

### Get CWL Group
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/currentwar/leaguegroup" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

### Get Capital Raid Seasons
```bash
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/capitalraidseasons?limit=5" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.'
```

---

## 📊 All Available Data Points by Category

### 🏰 CLAN DATA

#### Basic Info
- `tag` - Clan tag
- `name` - Clan name
- `type` - open, inviteOnly, closed
- `description` - Clan description
- `clanLevel` - Clan level (1-20+)
- `clanPoints` - Total trophy points
- `clanVersusPoints` - Builder base points
- `clanCapitalPoints` - Capital points
- `members` - Current member count (1-50)
- `requiredTrophies` - Min trophies to join
- `requiredTownhallLevel` - Min TH to join
- `requiredVersusTrophies` - Min builder trophies
- `isFamilyFriendly` - Family friendly flag

#### War Stats
- `warFrequency` - War frequency setting
- `warWinStreak` - Current win streak
- `warWins` - Total wins
- `warTies` - Total ties  
- `warLosses` - Total losses
- `isWarLogPublic` - Public war log flag
- `warLeague.id` - War league ID
- `warLeague.name` - War league name (e.g., "Crystal League II")

#### Location
- `location.id` - Location ID
- `location.name` - Country/region name
- `location.isCountry` - Is country boolean
- `location.countryCode` - 2-letter code

#### Capital
- `capitalLeague.id` - Capital league ID
- `capitalLeague.name` - Capital league name
- `clanCapital.capitalHallLevel` - Capital hall level (1-10)
- `clanCapital.districts[]` - Array of districts
  - `id` - District ID
  - `name` - District name
  - `districtHallLevel` - District level

#### Members
- `memberList[]` - Array of all members
  - `tag` - Player tag
  - `name` - Player name
  - `role` - member, admin, coLeader, leader
  - `expLevel` - XP level
  - `trophies` - Current trophies
  - `versusTrophies` - Builder trophies
  - `clanRank` - Rank by trophies
  - `previousClanRank` - Last season rank
  - `donations` - Troops donated this season
  - `donationsReceived` - Troops received
  - `league.id` - League ID
  - `league.name` - League name
  - `playerHouse.elements[]` - House decorations

#### Badges & Labels
- `badgeUrls.small` - Small badge URL
- `badgeUrls.medium` - Medium badge URL
- `badgeUrls.large` - Large badge URL
- `labels[]` - Array of clan labels
  - `id` - Label ID
  - `name` - Label name
  - `iconUrls` - Label icons

#### Language
- `chatLanguage.id` - Language ID
- `chatLanguage.name` - Language name
- `chatLanguage.languageCode` - 2-letter code

---

### 👤 PLAYER DATA

#### Basic Info
- `tag` - Player tag
- `name` - Player name
- `expLevel` - Experience level
- `trophies` - Current trophies
- `bestTrophies` - All-time best
- `attackWins` - Total attack wins
- `defenseWins` - Total defense wins
- `warStars` - Total war stars
- `townHallLevel` - TH level (1-16)
- `townHallWeaponLevel` - TH weapon level
- `builderHallLevel` - BH level (1-10)
- `builderBaseTrophies` - Builder trophies
- `bestBuilderBaseTrophies` - Best builder trophies

#### Clan Info (if in clan)
- `role` - member, admin, coLeader, leader
- `clan.tag` - Clan tag
- `clan.name` - Clan name
- `clan.clanLevel` - Clan level
- `clan.badgeUrls` - Clan badge URLs
- `donations` - Troops donated this season
- `donationsReceived` - Troops received
- `clanCapitalContributions` - Capital gold contributed
- `warPreference` - in or out

#### Leagues
- `league.id` - Trophy league ID
- `league.name` - Trophy league name
- `league.iconUrls` - League icon URLs
- `builderBaseLeague.id` - Builder league ID
- `builderBaseLeague.name` - Builder league name

#### Troops
- `troops[]` - Array of all troops
  - `name` - Troop name (e.g., "Barbarian")
  - `level` - Current level
  - `maxLevel` - Max for player's TH
  - `village` - "home" or "builderBase"
  - `superTroopIsActive` - Boolean (if super troop)

#### Heroes
- `heroes[]` - Array of heroes
  - `name` - Hero name (e.g., "Barbarian King")
  - `level` - Current level
  - `maxLevel` - Max for player's TH
  - `village` - "home" or "builderBase"
  - `equipment[]` - Equipped equipment
    - `name` - Equipment name
    - `level` - Equipment level
    - `maxLevel` - Max equipment level

#### Hero Equipment (all unlocked)
- `heroEquipment[]` - All equipment owned
  - `name` - Equipment name
  - `level` - Current level
  - `maxLevel` - Max level
  - `village` - "home"

#### Spells
- `spells[]` - Array of spells
  - `name` - Spell name (e.g., "Lightning Spell")
  - `level` - Current level
  - `maxLevel` - Max for player's TH
  - `village` - "home" or "builderBase"

#### Achievements
- `achievements[]` - Array of 60+ achievements
  - `name` - Achievement name
  - `stars` - Stars earned (0-3)
  - `value` - Current progress
  - `target` - Target value
  - `info` - Description
  - `completionInfo` - Completion text
  - `village` - "home" or "builderBase"

#### Legend Statistics
- `legendStatistics.legendTrophies` - Legend trophies
- `legendStatistics.bestSeason.id` - Best season ID
- `legendStatistics.bestSeason.rank` - Best rank
- `legendStatistics.bestSeason.trophies` - Best trophies
- `legendStatistics.currentSeason.rank` - Current rank
- `legendStatistics.currentSeason.trophies` - Current trophies
- `legendStatistics.previousSeason` - Previous season data

#### Player House
- `playerHouse.elements[]` - House decorations
  - `id` - Element ID
  - `type` - ground, walls, roof, decoration

#### Labels
- `labels[]` - Player labels
  - `id` - Label ID
  - `name` - Label name
  - `iconUrls` - Icon URLs

---

### ⚔️ WAR DATA

#### Current War Status
- `state` - notInWar, preparation, inWar, warEnded
- `teamSize` - Players per side (5, 10, 15, 20, 25, 30, 40, 50)
- `attacksPerMember` - Attacks allowed (usually 2)
- `preparationStartTime` - Prep start (ISO 8601)
- `startTime` - Battle start (ISO 8601)
- `endTime` - Battle end (ISO 8601)

#### Clan War Data (both sides)
- `clan.tag` - Clan tag
- `clan.name` - Clan name
- `clan.badgeUrls` - Badge URLs
- `clan.clanLevel` - Clan level
- `clan.attacks` - Total attacks used
- `clan.stars` - Total stars earned
- `clan.destructionPercentage` - Total destruction
- `clan.members[]` - War roster
  - `tag` - Player tag
  - `name` - Player name
  - `townhallLevel` - TH level
  - `mapPosition` - War map position (1-50)
  - `opponentAttacks` - Times attacked
  - `attacks[]` - Attack details
    - `order` - Attack sequence #
    - `attackerTag` - Attacker tag
    - `defenderTag` - Defender tag
    - `stars` - Stars earned (0-3)
    - `destructionPercentage` - Destruction % (0-100)
    - `duration` - Attack time in seconds
  - `bestOpponentAttack` - Best attack received (same structure)

#### Opponent Data
- `opponent` - Same structure as `clan` above

---

### 🏆 CWL DATA

#### League Group
- `state` - notInWar, preparation, war, ended
- `season` - Season ID (e.g., "2025-01")
- `clans[]` - Array of 8 clans in group
  - `tag` - Clan tag
  - `name` - Clan name
  - `clanLevel` - Clan level
  - `badgeUrls` - Badge URLs
  - `members[]` - Registered players (max 15)
    - `tag` - Player tag
    - `name` - Player name
    - `townHallLevel` - TH level
- `rounds[]` - 7 rounds of wars
  - `warTags[]` - War IDs for this round

#### CWL War Details
Use `/clanwarleagues/wars/{warTag}` to get individual war data.
Same structure as regular war but for 15v15 CWL matches.

---

### 🏛️ CAPITAL RAID DATA

#### Raid Weekend
- `state` - ongoing or ended
- `startTime` - Start timestamp (ISO 8601)
- `endTime` - End timestamp (ISO 8601)
- `capitalTotalLoot` - Total capital gold looted
- `raidsCompleted` - Number of raids done
- `totalAttacks` - Total attacks made
- `enemyDistrictsDestroyed` - Districts destroyed
- `offensiveReward` - Offensive raid medals
- `defensiveReward` - Defensive raid medals

#### Member Participation
- `members[]` - Raid participants
  - `tag` - Player tag
  - `name` - Player name
  - `attacks` - Attacks used
  - `attackLimit` - Base attack limit (5)
  - `bonusAttackLimit` - Bonus attacks earned
  - `capitalResourcesLooted` - Gold looted

#### Attack Log (Offense)
- `attackLog[]` - Attacks on enemy clans
  - `attacker.tag` - Attacker tag
  - `attacker.name` - Attacker name
  - `defenderTag` - Enemy clan tag
  - `defenderName` - Enemy clan name
  - `districts[]` - Districts attacked
    - `id` - District ID
    - `name` - District name
    - `stars` - Stars earned
    - `destructionPercent` - Destruction %
    - `attacks` - Attacks on this district

#### Defense Log (Defense)
- `defenseLog[]` - Enemy raids on your capital
  - `attacker.tag` - Enemy clan tag
  - `attacker.name` - Enemy clan name
  - `attackCount` - Total attacks received
  - `districtCount` - Districts targeted
  - `districtsDestroyed` - Districts lost
  - `districts[]` - Districts defended
    - `id` - District ID
    - `name` - District name
    - `stars` - Stars lost
    - `destructionPercent` - Destruction %
    - `attackCount` - Attacks received

---

### 📜 WAR LOG DATA

#### War History Entry
- `result` - "win", "lose", "tie", or null (ongoing)
- `endTime` - War end timestamp (ISO 8601)
- `teamSize` - Players per side
- `attacksPerMember` - Attacks per member
- `clan` - Your clan data
  - `tag` - Clan tag
  - `name` - Clan name
  - `badgeUrls` - Badge URLs
  - `clanLevel` - Clan level
  - `attacks` - Total attacks used
  - `stars` - Total stars earned
  - `destructionPercentage` - Total destruction
  - `expEarned` - XP earned
- `opponent` - Enemy clan (same structure, may have hidden tag)

---

### 🎖️ LEAGUES & RANKINGS

#### Trophy Leagues (29 leagues)
```
Unranked (0+) → Bronze III (400+) → Bronze II (500+) → Bronze I (600+)
Silver III (800+) → Silver II (1000+) → Silver I (1200+)
Gold III (1400+) → Gold II (1600+) → Gold I (1800+)
Crystal III (2000+) → Crystal II (2200+) → Crystal I (2400+)
Master III (2600+) → Master II (2800+) → Master I (3000+)
Champion III (3200+) → Champion II (3400+) → Champion I (3600+)
Titan III (3800+) → Titan II (4100+) → Titan I (4400+)
Legend League (5000+)
```

#### War Leagues (19 tiers)
```
Unranked → Bronze III → Bronze II → Bronze I
Silver III → Silver II → Silver I
Gold III → Gold II → Gold I
Crystal III → Crystal II → Crystal I
Master III → Master II → Master I
Champion III → Champion II → Champion I
```

#### Builder Base Leagues (31 tiers)
```
Wood League → Clay League → Stone League → Copper League
Brass League → Iron League → Steel League → Titanium League
Platinum League → Emerald League → Ruby League → Diamond League
Unranked → Bronze III → Bronze II → Bronze I
Silver III → Silver II → Silver I
Gold III → Gold II → Gold I
Crystal III → Crystal II → Crystal I
Master III → Master II → Master I
Champion III → Champion II → Champion I
Titan III → Titan II → Titan I
```

#### Capital Leagues (23 tiers)
Similar structure to War Leagues

---

### 🌍 LOCATIONS & RANKINGS

#### Get Rankings by Location
```bash
# Clan rankings (location 32000000 = Global)
/locations/32000000/rankings/clans

# Player rankings
/locations/32000000/rankings/players

# Builder base clan rankings
/locations/32000000/rankings/clans-versus

# Builder base player rankings
/locations/32000000/rankings/players-versus

# Capital rankings
/locations/32000000/rankings/capitals
```

#### Ranking Fields
- `tag` - Clan/player tag
- `name` - Name
- `rank` - Current rank
- `previousRank` - Previous rank
- `location` - Location info
- `clanLevel` / `expLevel` - Level
- `clanPoints` / `trophies` - Points
- `members` - Member count (clans only)

---

### 🏷️ LABELS

#### Clan Labels (56 labels)
Examples: "Clan Wars", "Clan War League", "Trophy Pushing", "Clan Games", 
"Farming", "Friendly", "Competitive", "Newbie Friendly", "Talkative", 
"Underdog", "Relaxed", "International", etc.

#### Player Labels (43 labels)
Examples: "Clan Wars", "Clan Games", "Trophy Pushing", "Farming", 
"Friendly", "Active Donator", "Active Daily", "Hungry Learner", 
"Competitive", "Talkative", "Teacher", "Veteran", etc.

Each label has:
- `id` - Unique ID
- `name` - Label name
- `iconUrls.small` - Small icon URL
- `iconUrls.medium` - Medium icon URL

---

## 🔧 Advanced Queries

### Get Specific Fields Only
```bash
# Player name and trophies only
curl -s "https://api.clashofclans.com/v1/players/%23VGQVRLRL" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '{name, trophies, league: .league.name}'
```

### Filter Clan Members by Donations
```bash
# Top donors
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.memberList | sort_by(-.donations) | .[0:10]'
```

### Get War Attack Stats
```bash
# All attacks in current war
curl -s "https://api.clashofclans.com/v1/clans/%232PR8R8V8P/currentwar" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.clan.members[].attacks[]'
```

### Track Hero Levels
```bash
# All heroes
curl -s "https://api.clashofclans.com/v1/players/%23VGQVRLRL" \
  -H "Authorization: Bearer YOUR_KEY" \
  | jq '.heroes[] | {name, level, maxLevel}'
```

---

## 📝 Notes

### Tag Formatting
- Tags always start with `#` (e.g., `#2PR8R8V8P`)
- URL encode the `#` as `%23` in API calls
- Valid tag characters: `0289PYLQGRJCUV`

### Rate Limiting
- Implement exponential backoff on 429 errors
- Cache static data (leagues, locations) for 24 hours
- Cache player/clan data for 5-15 minutes
- Cache war data for 1-5 minutes (updates frequently)

### Error Codes
- `400` - Bad request (check tag format)
- `403` - Access denied (check API key/IP whitelist)
- `404` - Not found (player/clan doesn't exist)
- `429` - Rate limit exceeded
- `500` - Server error (retry with backoff)
- `503` - Maintenance (wait and retry)

---

## 🎯 Complete List of All Endpoints

```
GET  /clans                                  # Search clans
GET  /clans/{clanTag}                        # Get clan details
GET  /clans/{clanTag}/members                # Get clan members
GET  /clans/{clanTag}/warlog                 # Get war history
GET  /clans/{clanTag}/currentwar             # Get current war
GET  /clans/{clanTag}/currentwar/leaguegroup # Get CWL group
GET  /clans/{clanTag}/capitalraidseasons     # Get capital raids

GET  /players/{playerTag}                    # Get player profile
POST /players/{playerTag}/verifytoken        # Verify player token

GET  /clanwarleagues/wars/{warTag}           # Get CWL war details

GET  /leagues                                # List trophy leagues
GET  /leagues/{leagueId}                     # Get league details
GET  /leagues/{leagueId}/seasons             # Get league seasons (Legend only)
GET  /leagues/{leagueId}/seasons/{seasonId}  # Get season rankings

GET  /warleagues                             # List war leagues
GET  /warleagues/{leagueId}                  # Get war league details

GET  /capitalleagues                         # List capital leagues
GET  /capitalleagues/{leagueId}              # Get capital league details

GET  /builderbaseleagues                     # List builder leagues
GET  /builderbaseleagues/{leagueId}          # Get builder league details

GET  /locations                              # List all locations
GET  /locations/{locationId}                 # Get location details
GET  /locations/{locationId}/rankings/clans           # Clan rankings
GET  /locations/{locationId}/rankings/players         # Player rankings
GET  /locations/{locationId}/rankings/clans-versus    # Builder clan rankings
GET  /locations/{locationId}/rankings/players-versus  # Builder player rankings
GET  /locations/{locationId}/rankings/capitals        # Capital rankings

GET  /labels/clans                           # List clan labels
GET  /labels/players                         # List player labels

GET  /goldpass/seasons/current               # Current Gold Pass season
```

**Total: 36 unique endpoints** covering every aspect of Clash of Clans!

---

## 🎁 Bonus: Common Data Aggregations

### Clan Health Score
```javascript
{
  avgDonations: sum(donations) / memberCount,
  avgTrophies: sum(trophies) / memberCount,
  warWinRate: warWins / (warWins + warLosses + warTies),
  capitalContributions: sum(clanCapitalContributions),
  activeMembers: count(donations > 0)
}
```

### Player Progress Score
```javascript
{
  thProgress: townHallLevel / 16,
  heroAvg: avg(heroes.level / heroes.maxLevel),
  troopProgress: avg(troops.level / troops.maxLevel),
  achievementProgress: sum(achievements.stars) / (achievements.length * 3)
}
```

---

**📦 Complete Package:**
1. Read `COC_API_COMPLETE_REFERENCE.json` for full documentation
2. Check `COC_API_REAL_DATA_EXAMPLES.json` for real response examples
3. Use this file for quick lookups and copy-paste commands

**Everything the CoC API can provide is documented here!** 🎮



