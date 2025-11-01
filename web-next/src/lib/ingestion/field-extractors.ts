/**
 * Field Extraction Utilities for Data Enrichment
 * 
 * These functions extract specific fields from Clash of Clans API playerDetails
 * for historical tracking in member_snapshot_stats.
 * 
 * @module field-extractors
 */

/**
 * Extract pet levels from player detail
 * @returns Object mapping pet name to level, e.g. {"L.A.S.S.I": 10, "Electro Owl": 8}
 */
export function extractPetLevels(playerDetail: any): Record<string, number> | null {
  const pets = playerDetail?.pets || [];
  if (pets.length === 0) return null;

  return pets.reduce((acc: Record<string, number>, pet: any) => {
    if (pet.name && typeof pet.level === 'number') {
      acc[pet.name] = pet.level;
    }
    return acc;
  }, {});
}

/**
 * Count number of troops at max level for current TH
 * @returns Count of maxed home village troops
 */
export function countMaxedTroops(playerDetail: any): number | null {
  const troops = playerDetail?.troops || [];
  if (troops.length === 0) return null;

  const maxedCount = troops.filter((troop: any) => {
    // Only count home village troops
    if (troop.village !== 'home' && troop.village !== undefined) {
      return false;
    }
    // Check if at max level
    return troop.level === troop.maxLevel;
  }).length;

  return maxedCount;
}

/**
 * Count number of spells at max level for current TH
 * @returns Count of maxed spells
 */
export function countMaxedSpells(playerDetail: any): number | null {
  const spells = playerDetail?.spells || [];
  if (spells.length === 0) return null;

  const maxedCount = spells.filter((spell: any) => {
    // Only count home village spells
    if (spell.village !== 'home' && spell.village !== undefined) {
      return false;
    }
    // Check if at max level
    return spell.level === spell.maxLevel;
  }).length;

  return maxedCount;
}

/**
 * Get list of active super troops
 * @returns Array of active super troop names, or null if none
 */
export function getActiveSuperTroops(playerDetail: any): string[] | null {
  const troops = playerDetail?.troops || [];
  if (troops.length === 0) return null;

  const activeSuperTroops = troops
    .filter((troop: any) => troop.superTroopIsActive === true)
    .map((troop: any) => troop.name);

  return activeSuperTroops.length > 0 ? activeSuperTroops : null;
}

/**
 * Extract hero equipment levels
 * @returns Object mapping equipment name to level, e.g. {"Barbarian Puppet": 18}
 */
export function extractEquipmentLevels(playerDetail: any): Record<string, number> | null {
  const equipment = playerDetail?.heroEquipment || [];
  if (equipment.length === 0) return null;

  return equipment.reduce((acc: Record<string, number>, item: any) => {
    if (item.name && typeof item.level === 'number') {
      acc[item.name] = item.level;
    }
    return acc;
  }, {});
}

/**
 * Count completed achievements (3-star)
 * @returns Number of fully completed achievements
 */
export function countCompletedAchievements(playerDetail: any): number | null {
  const achievements = playerDetail?.achievements || [];
  if (achievements.length === 0) return null;

  return achievements.filter((achievement: any) => achievement.stars === 3).length;
}

/**
 * Calculate total achievement score (sum of all stars)
 * @returns Total stars earned across all achievements
 */
export function calculateAchievementScore(playerDetail: any): number | null {
  const achievements = playerDetail?.achievements || [];
  if (achievements.length === 0) return null;

  return achievements.reduce((sum: number, achievement: any) => {
    return sum + (achievement.stars || 0);
  }, 0);
}

/**
 * Extract Builder Base metrics
 */
export function extractBuilderBaseMetrics(playerDetail: any) {
  return {
    builderHallLevel: playerDetail?.builderHallLevel ?? null,
    versusTrophies: playerDetail?.builderBaseTrophies ?? playerDetail?.versusTrophies ?? null,
    versusBattleWins: playerDetail?.versusBattleWins ?? null,
    builderLeagueId: playerDetail?.builderBaseLeague?.id ?? null,
    builderLeagueName: playerDetail?.builderBaseLeague?.name ?? null,
  };
}

/**
 * Extract war & raid statistics
 */
export function extractWarStats(playerDetail: any) {
  return {
    warStars: playerDetail?.warStars ?? null,
    attackWins: playerDetail?.attackWins ?? null,
    defenseWins: playerDetail?.defenseWins ?? null,
    capitalContributions: playerDetail?.clanCapitalContributions ?? null,
  };
}

/**
 * Extract experience & progression metrics
 */
export function extractExperienceMetrics(playerDetail: any) {
  return {
    expLevel: playerDetail?.expLevel ?? null,
    bestTrophies: playerDetail?.bestTrophies ?? null,
    bestVersusTrophies: playerDetail?.bestVersusTrophies ?? null,
  };
}

/**
 * Comprehensive extraction of all enriched fields
 * @param playerDetail Full player detail object from CoC API
 * @returns Object with all enriched fields ready for database insertion
 */
export function extractEnrichedFields(playerDetail: any) {
  if (!playerDetail) {
    return {
      petLevels: null,
      builderHallLevel: null,
      versusTrophies: null,
      versusBattleWins: null,
      builderLeagueId: null,
      warStars: null,
      attackWins: null,
      defenseWins: null,
      capitalContributions: null,
      maxTroopCount: null,
      maxSpellCount: null,
      superTroopsActive: null,
      achievementCount: null,
      achievementScore: null,
      expLevel: null,
      bestTrophies: null,
      bestVersusTrophies: null,
      equipmentLevels: null,
    };
  }

  const builderBase = extractBuilderBaseMetrics(playerDetail);
  const warStats = extractWarStats(playerDetail);
  const experience = extractExperienceMetrics(playerDetail);

  return {
    // Pets
    petLevels: extractPetLevels(playerDetail),
    
    // Builder Base
    builderHallLevel: builderBase.builderHallLevel,
    versusTrophies: builderBase.versusTrophies,
    versusBattleWins: builderBase.versusBattleWins,
    builderLeagueId: builderBase.builderLeagueId,
    
    // War & Raids
    warStars: warStats.warStars,
    attackWins: warStats.attackWins,
    defenseWins: warStats.defenseWins,
    capitalContributions: warStats.capitalContributions,
    
    // Troops & Spells
    maxTroopCount: countMaxedTroops(playerDetail),
    maxSpellCount: countMaxedSpells(playerDetail),
    superTroopsActive: getActiveSuperTroops(playerDetail),
    
    // Achievements
    achievementCount: countCompletedAchievements(playerDetail),
    achievementScore: calculateAchievementScore(playerDetail),
    
    // Experience
    expLevel: experience.expLevel,
    bestTrophies: experience.bestTrophies,
    bestVersusTrophies: experience.bestVersusTrophies,
    
    // Equipment (enhanced format)
    equipmentLevels: extractEquipmentLevels(playerDetail),
  };
}

