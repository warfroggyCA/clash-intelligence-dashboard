# API vs Canonical Storage - Complete Delta Analysis

## 📊 Overview

This document compares all available data points from the Clash of Clans API against what's currently stored in canonical member snapshots.

---

## 👤 PLAYER DATA DELTA

### ✅ Currently Stored in Canonical

#### Basic Info
- ✅ `tag` - Player tag
- ✅ `name` - Player name
- ✅ `role` - member, admin, coLeader, leader
- ✅ `townHallLevel` - TH level (1-16)
- ✅ `expLevel` - Experience level

#### Trophies & Leagues
- ✅ `trophies` - Current trophies
- ✅ `battleModeTrophies` - Ranked/battle mode trophies
- ✅ `bestTrophies` - All-time highest trophies
- ✅ `bestVersusTrophies` - Best builder trophies
- ✅ `league.id` - Trophy league ID
- ✅ `league.name` - Trophy league name
- ✅ `league.trophies` - League trophy count
- ✅ `league.iconSmall` - Small league icon URL
- ✅ `league.iconMedium` - Medium league icon URL
- ✅ `ranked.trophies` - Ranked tournament trophies
- ✅ `ranked.leagueId` - Ranked league ID
- ✅ `ranked.leagueName` - Ranked league name
- ✅ `ranked.iconSmall` - Ranked league icon (small)
- ✅ `ranked.iconMedium` - Ranked league icon (medium)

#### Donations
- ✅ `donations.given` - Troops donated this season
- ✅ `donations.received` - Troops received this season

#### War Stats
- ✅ `war.stars` - Total war stars earned
- ✅ `war.attackWins` - Total attack wins
- ✅ `war.defenseWins` - Total defense wins
- ❌ `warPreference` - **MISSING** - in or out

#### Builder Base
- ✅ `builderBase.hallLevel` - Builder Hall level (1-10)
- ✅ `builderBase.trophies` - Builder base trophies
- ✅ `builderBase.battleWins` - Builder battle wins
- ✅ `builderBase.leagueId` - Builder league ID
- ❌ `builderBase.leagueName` - **MISSING** - Builder league name

#### Capital
- ✅ `capitalContributions` - Capital gold contributed

#### Heroes
- ✅ `heroLevels` - All hero levels (BK, AQ, GW, RC, MP)

#### Pets
- ✅ `pets` - All pet levels (as Record<string, number>)

#### Equipment
- ✅ `equipmentLevels` - All equipment levels (as Record<string, number>)

#### Achievements
- ✅ `achievements.count` - Total achievements completed
- ✅ `achievements.score` - Total achievement stars earned

#### Other
- ✅ `rushPercent` - Calculated rush percentage
- ✅ `activityScore` - Calculated activity score
- ✅ `superTroopsActive` - Array of active super troop names
- ✅ `tenure.days` - Clan tenure in days
- ✅ `tenure.asOf` - Tenure calculation date

### ❌ Missing from Canonical (Available in API)

#### Basic Info
- ❌ `townHallWeaponLevel` - TH weapon level (for TH12+)
- ❌ `clan.tag` - Clan tag (if in clan) - **Partially stored in snapshot metadata**
- ❌ `clan.name` - Clan name - **Partially stored in snapshot metadata**
- ❌ `clan.clanLevel` - Clan level

#### Player Labels
- ❌ `labels[]` - Player labels/tags
  - `id` - Label ID
  - `name` - Label name
  - `iconUrls` - Label icon URLs

#### Player House
- ❌ `playerHouse.elements[]` - House decoration elements
  - `id` - Element ID
  - `type` - Element type (ground, walls, roof, decoration)

#### Troops & Spells (Detailed)
- ❌ `troops[]` - Array of all troops with levels
  - `name` - Troop name
  - `level` - Current level
  - `maxLevel` - Max level for player's TH
  - `village` - "home" or "builderBase"
  - `superTroopIsActive` - Boolean (for super troops)
- ❌ `spells[]` - Array of all spells with levels
  - `name` - Spell name
  - `level` - Current level
  - `maxLevel` - Max level for player's TH
  - `village` - "home" or "builderBase"

#### Hero Equipment (Detailed)
- ❌ `heroes[].equipment[]` - Currently equipped equipment per hero
  - `name` - Equipment name
  - `level` - Equipment level
  - `maxLevel` - Max equipment level
- ❌ `heroEquipment[]` - All unlocked equipment (we have levels, but not max levels or which hero)

#### Legend Statistics
- ❌ `legendStatistics.legendTrophies` - Legend league trophies
- ❌ `legendStatistics.bestSeason` - Best season performance
  - `id` - Season ID
  - `rank` - Global rank
  - `trophies` - Trophies earned
- ❌ `legendStatistics.currentSeason` - Current season
  - `rank` - Current rank
  - `trophies` - Current trophies
- ❌ `legendStatistics.previousSeason` - Previous season
  - `id` - Season ID
  - `rank` - Final rank
  - `trophies` - Final trophies

#### Achievements (Detailed)
- ❌ `achievements[]` - Array of individual achievements
  - `name` - Achievement name
  - `stars` - Stars earned (0-3)
  - `value` - Current progress value
  - `target` - Target value for completion
  - `info` - Description
  - `completionInfo` - Completion description
  - `village` - "home" or "builderBase"
- **Note:** We store `count` and `score` but not individual achievement details

#### Builder Base League
- ❌ `builderBaseLeague.id` - Builder league ID (we have this)
- ❌ `builderBaseLeague.name` - Builder league name (we're missing this)
- ❌ `builderBaseLeague.iconUrls` - Builder league icon URLs

#### Clan Member List Specific Fields
- ❌ `clanRank` - Rank in clan (by trophies) - **Available in memberList**
- ❌ `previousClanRank` - Previous season rank - **Available in memberList**
- ❌ `playerHouse.elements[]` - House decorations - **Available in memberList**

---

## 🏰 CLAN DATA DELTA

### ✅ Currently Stored (in clans table)
- ✅ `tag` - Clan tag
- ✅ `name` - Clan name
- ✅ `logo_url` - Badge URL (largest)

### ❌ Missing from Storage (Available in API)

#### Basic Info
- ❌ `type` - Clan type (open, inviteOnly, closed)
- ❌ `description` - Clan description text
- ❌ `clanLevel` - Clan level (1-20+)
- ❌ `clanPoints` - Total clan points
- ❌ `clanVersusPoints` - Builder base clan points
- ❌ `clanCapitalPoints` - Capital points
- ❌ `members` - Current member count (1-50)
- ❌ `requiredTrophies` - Minimum trophies to join
- ❌ `requiredTownhallLevel` - Minimum TH level to join
- ❌ `requiredVersusTrophies` - Minimum builder trophies
- ❌ `isFamilyFriendly` - Family friendly flag

#### War Stats
- ❌ `warFrequency` - War frequency setting
- ❌ `warWinStreak` - Current war win streak
- ❌ `warWins` - Total wins
- ❌ `warTies` - Total ties
- ❌ `warLosses` - Total losses
- ❌ `isWarLogPublic` - Public war log flag
- ❌ `warLeague.id` - War league ID
- ❌ `warLeague.name` - War league name

#### Location
- ❌ `location.id` - Location ID
- ❌ `location.name` - Location name
- ❌ `location.isCountry` - Is country boolean
- ❌ `location.countryCode` - 2-letter country code

#### Capital
- ❌ `capitalLeague.id` - Capital league ID
- ❌ `capitalLeague.name` - Capital league name
- ❌ `clanCapital.capitalHallLevel` - Capital hall level (1-10)
- ❌ `clanCapital.districts[]` - Array of districts
  - `id` - District ID
  - `name` - District name
  - `districtHallLevel` - District level

#### Labels & Language
- ❌ `labels[]` - Array of clan labels
  - `id` - Label ID
  - `name` - Label name
  - `iconUrls` - Label icon URLs
- ❌ `chatLanguage.id` - Language ID
- ❌ `chatLanguage.name` - Language name
- ❌ `chatLanguage.languageCode` - 2-letter language code

#### Badge URLs (Detailed)
- ❌ `badgeUrls.small` - Small badge URL (we only store largest)
- ❌ `badgeUrls.medium` - Medium badge URL (we only store largest)
- ❌ `badgeUrls.large` - Large badge URL (we store this as logo_url)

---

## 🔍 MEMBER LIST SPECIFIC FIELDS

### ✅ Currently Captured from memberList
- ✅ `tag` - Player tag
- ✅ `name` - Player name
- ✅ `role` - member, admin, coLeader, leader
- ✅ `trophies` - Current trophies
- ✅ `versusTrophies` - Builder trophies
- ✅ `donations` - Troops donated this season
- ✅ `donationsReceived` - Troops received
- ✅ `expLevel` - XP level
- ✅ `league.id` - League ID
- ✅ `league.name` - League name

### ❌ Missing from memberList Data
- ❌ `clanRank` - Rank in clan (by trophies)
- ❌ `previousClanRank` - Previous season rank
- ❌ `playerHouse.elements[]` - House decoration elements
- ❌ `league.iconUrls` - League icon URLs (we capture this from player detail API)

---

## 📈 SUMMARY STATISTICS

### Player Data
- **Total API Fields Available:** ~100+ fields
- **Currently Stored:** ~35 fields
- **Missing:** ~65 fields
- **Coverage:** ~35%

### Clan Data
- **Total API Fields Available:** ~30+ fields
- **Currently Stored:** ~3 fields
- **Missing:** ~27 fields
- **Coverage:** ~10%

### Priority Missing Fields (High Value)

#### Player Fields
1. **`warPreference`** - War opt-in status (already identified)
2. **`townHallWeaponLevel`** - TH weapon level for TH12+
3. **`builderBaseLeague.name`** - Builder league name (we have ID but not name)
4. **`labels[]`** - Player labels (could be useful for categorization)
5. **`legendStatistics`** - Legend league performance data
6. **`clanRank`** - Rank in clan (useful for sorting/display)
7. **`previousClanRank`** - Previous season rank (useful for trends)

#### Clan Fields
1. **`warFrequency`** - War frequency setting
2. **`warLeague.name`** - War league name
3. **`warWinStreak`** - Current win streak
4. **`warWins/warLosses/warTies`** - Historical war stats
5. **`clanLevel`** - Clan level
6. **`clanPoints`** - Total clan points
7. **`clanCapitalPoints`** - Capital points
8. **`capitalLeague`** - Capital league info
9. **`clanCapital.districts[]`** - Capital districts
10. **`location`** - Clan location/country

### Low Priority Missing Fields (Lower Value)

#### Player Fields
- `playerHouse.elements[]` - House decorations (cosmetic)
- `troops[]` detailed array - We don't need individual troop levels for most use cases
- `spells[]` detailed array - We don't need individual spell levels for most use cases
- Individual `achievements[]` details - We have count/score which is usually sufficient

#### Clan Fields
- `labels[]` - Clan labels (could be useful but not critical)
- `chatLanguage` - Language preference (not critical)
- `description` - Clan description (could be useful)
- `isFamilyFriendly` - Family friendly flag (not critical)

---

## 🎯 RECOMMENDATIONS

### High Priority Additions
1. **`warPreference`** - Add to `WarInfo` interface and capture in ingestion
2. **`townHallWeaponLevel`** - Add to basic info (useful for TH12+ progression)
3. **`builderBaseLeague.name`** - Add to `BuilderBaseInfo` interface
4. **`clanRank`** - Store from memberList (useful for roster sorting)
5. **`previousClanRank`** - Store from memberList (useful for rank changes)

### Medium Priority Additions
1. **Clan war stats** - `warFrequency`, `warLeague`, `warWinStreak`, `warWins/warLosses`
2. **Clan capital info** - `clanCapitalPoints`, `capitalLeague`, `clanCapital.districts`
3. **Player labels** - `labels[]` (could enable filtering/categorization)
4. **Legend statistics** - `legendStatistics` (useful for Legend League players)

### Low Priority (Nice to Have)
1. **Clan location** - `location` (could be useful for demographics)
2. **Clan labels** - `labels[]` (could be useful for filtering)
3. **Player house** - `playerHouse.elements[]` (cosmetic)
4. **Detailed troops/spells** - Individual arrays (we have superTroopsActive which covers most needs)

---

## 📝 NOTES

1. **`extras` field** - The canonical snapshot has an `extras` field that can store arbitrary data. Some missing fields might be stored there, but they're not typed/structured.

2. **Member List vs Player Detail** - Some fields are available in both `/clans/{tag}` memberList and `/players/{tag}` endpoints. We prioritize player detail API when available for accuracy.

3. **Calculated Fields** - Some fields like `rushPercent` and `activityScore` are calculated, not directly from API.

4. **Historical Data** - Some fields like `previousClanRank` are only available in the memberList endpoint, not in individual player profiles.

5. **War Preference** - Only available in `/players/{tag}` endpoint, not in `/clans/{tag}/members` memberList.

