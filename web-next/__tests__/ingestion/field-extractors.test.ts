/**
 * Unit Tests for Field Extractors
 * 
 * Tests the enriched data extraction utilities to ensure they handle
 * various API response formats and edge cases correctly.
 * 
 * @jest-environment node
 */

import {
  extractPetLevels,
  countMaxedTroops,
  countMaxedSpells,
  getActiveSuperTroops,
  extractEquipmentLevels,
  countCompletedAchievements,
  calculateAchievementScore,
  extractBuilderBaseMetrics,
  extractWarStats,
  extractExperienceMetrics,
  extractEnrichedFields,
} from '@/lib/ingestion/field-extractors';

describe('extractPetLevels', () => {
  it('should extract pet levels correctly', () => {
    const playerDetail = {
      pets: [
        { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
        { name: 'Electro Owl', level: 8, maxLevel: 15, village: 'home' },
      ],
    };

    const result = extractPetLevels(playerDetail);
    expect(result).toEqual({
      'L.A.S.S.I': 10,
      'Electro Owl': 8,
    });
  });

  it('should return null when no pets exist', () => {
    expect(extractPetLevels({})).toBeNull();
    expect(extractPetLevels({ pets: [] })).toBeNull();
    expect(extractPetLevels(null)).toBeNull();
  });

  it('should handle invalid pet data gracefully', () => {
    const playerDetail = {
      pets: [
        { name: 'L.A.S.S.I', level: 10 },
        { level: 5 }, // Missing name
        { name: 'Unicorn' }, // Missing level
      ],
    };

    const result = extractPetLevels(playerDetail);
    expect(result).toEqual({
      'L.A.S.S.I': 10,
    });
  });
});

describe('countMaxedTroops', () => {
  it('should count maxed home village troops correctly', () => {
    const playerDetail = {
      troops: [
        { name: 'Barbarian', level: 11, maxLevel: 11, village: 'home' },
        { name: 'Archer', level: 11, maxLevel: 11, village: 'home' },
        { name: 'Giant', level: 10, maxLevel: 11, village: 'home' }, // Not maxed
        { name: 'Raged Barbarian', level: 20, maxLevel: 20, village: 'builderBase' }, // Wrong village
      ],
    };

    const result = countMaxedTroops(playerDetail);
    expect(result).toBe(2);
  });

  it('should return null when no troops exist', () => {
    expect(countMaxedTroops({})).toBeNull();
    expect(countMaxedTroops({ troops: [] })).toBeNull();
  });

  it('should handle troops without village field (defaults to home)', () => {
    const playerDetail = {
      troops: [
        { name: 'Barbarian', level: 11, maxLevel: 11 }, // No village field
      ],
    };

    const result = countMaxedTroops(playerDetail);
    expect(result).toBe(1);
  });
});

describe('countMaxedSpells', () => {
  it('should count maxed spells correctly', () => {
    const playerDetail = {
      spells: [
        { name: 'Lightning Spell', level: 9, maxLevel: 9, village: 'home' },
        { name: 'Healing Spell', level: 9, maxLevel: 9, village: 'home' },
        { name: 'Rage Spell', level: 6, maxLevel: 9, village: 'home' }, // Not maxed
      ],
    };

    const result = countMaxedSpells(playerDetail);
    expect(result).toBe(2);
  });

  it('should return null when no spells exist', () => {
    expect(countMaxedSpells({})).toBeNull();
    expect(countMaxedSpells({ spells: [] })).toBeNull();
  });
});

describe('getActiveSuperTroops', () => {
  it('should return list of active super troops', () => {
    const playerDetail = {
      troops: [
        { name: 'Super Barbarian', level: 9, superTroopIsActive: true },
        { name: 'Super Archer', level: 9, superTroopIsActive: true },
        { name: 'Super Giant', level: 9, superTroopIsActive: false },
        { name: 'Barbarian', level: 11, superTroopIsActive: undefined },
      ],
    };

    const result = getActiveSuperTroops(playerDetail);
    expect(result).toEqual(['Super Barbarian', 'Super Archer']);
  });

  it('should return null when no super troops are active', () => {
    const playerDetail = {
      troops: [
        { name: 'Barbarian', level: 11, superTroopIsActive: false },
      ],
    };

    expect(getActiveSuperTroops(playerDetail)).toBeNull();
  });

  it('should return null when no troops exist', () => {
    expect(getActiveSuperTroops({})).toBeNull();
    expect(getActiveSuperTroops({ troops: [] })).toBeNull();
  });
});

describe('extractEquipmentLevels', () => {
  it('should extract equipment levels correctly', () => {
    const playerDetail = {
      heroEquipment: [
        { name: 'Barbarian Puppet', level: 18, maxLevel: 18 },
        { name: 'Rage Vial', level: 15, maxLevel: 18 },
      ],
    };

    const result = extractEquipmentLevels(playerDetail);
    expect(result).toEqual({
      'Barbarian Puppet': 18,
      'Rage Vial': 15,
    });
  });

  it('should return null when no equipment exists', () => {
    expect(extractEquipmentLevels({})).toBeNull();
    expect(extractEquipmentLevels({ heroEquipment: [] })).toBeNull();
  });
});

describe('countCompletedAchievements', () => {
  it('should count 3-star achievements', () => {
    const playerDetail = {
      achievements: [
        { name: 'Gold Grab', stars: 3, value: 1000000, target: 1000000 },
        { name: 'Elixir Escapade', stars: 3, value: 1000000, target: 1000000 },
        { name: 'Nice and Tidy', stars: 2, value: 500, target: 1000 }, // Not complete
        { name: 'Get those Goblins!', stars: 1, value: 100, target: 500 },
      ],
    };

    const result = countCompletedAchievements(playerDetail);
    expect(result).toBe(2);
  });

  it('should return null when no achievements exist', () => {
    expect(countCompletedAchievements({})).toBeNull();
    expect(countCompletedAchievements({ achievements: [] })).toBeNull();
  });
});

describe('calculateAchievementScore', () => {
  it('should sum all achievement stars', () => {
    const playerDetail = {
      achievements: [
        { name: 'Gold Grab', stars: 3 },
        { name: 'Elixir Escapade', stars: 3 },
        { name: 'Nice and Tidy', stars: 2 },
        { name: 'Get those Goblins!', stars: 1 },
      ],
    };

    const result = calculateAchievementScore(playerDetail);
    expect(result).toBe(9);
  });

  it('should handle missing stars field', () => {
    const playerDetail = {
      achievements: [
        { name: 'Gold Grab', stars: 3 },
        { name: 'No Stars' }, // Missing stars field
      ],
    };

    const result = calculateAchievementScore(playerDetail);
    expect(result).toBe(3);
  });

  it('should return null when no achievements exist', () => {
    expect(calculateAchievementScore({})).toBeNull();
    expect(calculateAchievementScore({ achievements: [] })).toBeNull();
  });
});

describe('extractBuilderBaseMetrics', () => {
  it('should extract builder base metrics', () => {
    const playerDetail = {
      builderHallLevel: 10,
      versusTrophies: 2800,
      versusBattleWins: 450,
      builderBaseLeague: { id: 44000026, name: 'Steel League III' },
    };

    const result = extractBuilderBaseMetrics(playerDetail);
    expect(result).toEqual({
      builderHallLevel: 10,
      versusTrophies: 2800,
      versusBattleWins: 450,
      builderLeagueId: 44000026,
    });
  });

  it('should handle missing builder base data', () => {
    const result = extractBuilderBaseMetrics({});
    expect(result).toEqual({
      builderHallLevel: null,
      versusTrophies: null,
      versusBattleWins: null,
      builderLeagueId: null,
    });
  });
});

describe('extractWarStats', () => {
  it('should extract war statistics', () => {
    const playerDetail = {
      warStars: 387,
      attackWins: 2150,
      defenseWins: 850,
      clanCapitalContributions: 125000,
    };

    const result = extractWarStats(playerDetail);
    expect(result).toEqual({
      warStars: 387,
      attackWins: 2150,
      defenseWins: 850,
      capitalContributions: 125000,
    });
  });

  it('should handle missing war stats', () => {
    const result = extractWarStats({});
    expect(result).toEqual({
      warStars: null,
      attackWins: null,
      defenseWins: null,
      capitalContributions: null,
    });
  });

  it('should handle zero values correctly', () => {
    const playerDetail = {
      warStars: 0,
      attackWins: 0,
    };

    const result = extractWarStats(playerDetail);
    expect(result.warStars).toBe(0);
    expect(result.attackWins).toBe(0);
  });
});

describe('extractExperienceMetrics', () => {
  it('should extract experience metrics', () => {
    const playerDetail = {
      expLevel: 180,
      bestTrophies: 4200,
      bestVersusTrophies: 3500,
    };

    const result = extractExperienceMetrics(playerDetail);
    expect(result).toEqual({
      expLevel: 180,
      bestTrophies: 4200,
      bestVersusTrophies: 3500,
    });
  });

  it('should handle missing experience data', () => {
    const result = extractExperienceMetrics({});
    expect(result).toEqual({
      expLevel: null,
      bestTrophies: null,
      bestVersusTrophies: null,
    });
  });
});

describe('extractEnrichedFields (integration)', () => {
  it('should extract all enriched fields from complete player detail', () => {
    const playerDetail = {
      pets: [{ name: 'L.A.S.S.I', level: 10 }],
      builderHallLevel: 10,
      versusTrophies: 2800,
      versusBattleWins: 450,
      builderBaseLeague: { id: 44000026 },
      warStars: 387,
      attackWins: 2150,
      defenseWins: 850,
      clanCapitalContributions: 125000,
      troops: [
        { name: 'Barbarian', level: 11, maxLevel: 11, village: 'home' },
        { name: 'Archer', level: 10, maxLevel: 11, village: 'home' },
      ],
      spells: [
        { name: 'Lightning', level: 9, maxLevel: 9, village: 'home' },
      ],
      heroEquipment: [
        { name: 'Barbarian Puppet', level: 18 },
      ],
      achievements: [
        { name: 'Gold Grab', stars: 3 },
        { name: 'Elixir Escapade', stars: 2 },
      ],
      expLevel: 180,
      bestTrophies: 4200,
      bestVersusTrophies: 3500,
    };

    const result = extractEnrichedFields(playerDetail);

    expect(result.petLevels).toEqual({ 'L.A.S.S.I': 10 });
    expect(result.builderHallLevel).toBe(10);
    expect(result.versusTrophies).toBe(2800);
    expect(result.warStars).toBe(387);
    expect(result.maxTroopCount).toBe(1); // Only Barbarian is maxed
    expect(result.maxSpellCount).toBe(1);
    expect(result.equipmentLevels).toEqual({ 'Barbarian Puppet': 18 });
    expect(result.achievementCount).toBe(1); // Only one 3-star
    expect(result.achievementScore).toBe(5); // 3 + 2
    expect(result.expLevel).toBe(180);
  });

  it('should return all nulls when player detail is null', () => {
    const result = extractEnrichedFields(null);

    expect(result.petLevels).toBeNull();
    expect(result.builderHallLevel).toBeNull();
    expect(result.warStars).toBeNull();
    expect(result.achievementCount).toBeNull();
  });

  it('should return all nulls when player detail is empty object', () => {
    const result = extractEnrichedFields({});

    expect(result.petLevels).toBeNull();
    expect(result.builderHallLevel).toBeNull();
    expect(result.warStars).toBeNull();
    expect(result.achievementCount).toBeNull();
  });

  it('should handle partial player data', () => {
    const playerDetail = {
      pets: [{ name: 'L.A.S.S.I', level: 5 }],
      warStars: 100,
      // Missing: builder base, troops, spells, etc.
    };

    const result = extractEnrichedFields(playerDetail);

    expect(result.petLevels).toEqual({ 'L.A.S.S.I': 5 });
    expect(result.warStars).toBe(100);
    expect(result.builderHallLevel).toBeNull();
    expect(result.maxTroopCount).toBeNull();
  });
});

describe('Edge Cases', () => {
  describe('Zero Values', () => {
    it('should preserve zero values (not treat as null)', () => {
      const playerDetail = {
        warStars: 0,
        attackWins: 0,
        versusTrophies: 0,
        builderHallLevel: 0, // Technically invalid, but should preserve
      };

      const result = extractEnrichedFields(playerDetail);
      expect(result.warStars).toBe(0);
      expect(result.attackWins).toBe(0);
      expect(result.versusTrophies).toBe(0);
      expect(result.builderHallLevel).toBe(0);
    });
  });

  describe('Large Numbers', () => {
    it('should handle very large cumulative stats', () => {
      const playerDetail = {
        attackWins: 10000,
        defenseWins: 5000,
        clanCapitalContributions: 999999,
        expLevel: 500,
      };

      const result = extractEnrichedFields(playerDetail);
      expect(result.attackWins).toBe(10000);
      expect(result.defenseWins).toBe(5000);
      expect(result.capitalContributions).toBe(999999);
      expect(result.expLevel).toBe(500);
    });
  });

  describe('Low-Level Players', () => {
    it('should handle TH7 player with minimal unlocks', () => {
      const playerDetail = {
        townHallLevel: 7,
        pets: [], // No pets unlocked yet
        heroEquipment: [], // No equipment
        builderHallLevel: 3,
        troops: [
          { name: 'Barbarian', level: 5, maxLevel: 5, village: 'home' },
        ],
      };

      const result = extractEnrichedFields(playerDetail);
      expect(result.petLevels).toBeNull();
      expect(result.equipmentLevels).toBeNull();
      expect(result.builderHallLevel).toBe(3);
      expect(result.maxTroopCount).toBe(1);
    });
  });

  describe('Maxed Player', () => {
    it('should handle fully maxed TH16 player', () => {
      const playerDetail = {
        pets: [
          { name: 'L.A.S.S.I', level: 15, maxLevel: 15 },
          { name: 'Electro Owl', level: 15, maxLevel: 15 },
          { name: 'Mighty Yak', level: 15, maxLevel: 15 },
          { name: 'Unicorn', level: 15, maxLevel: 15 },
        ],
        heroEquipment: Array(12).fill({ name: 'Equipment', level: 18, maxLevel: 18 }),
        troops: Array(30).fill({ name: 'Troop', level: 12, maxLevel: 12, village: 'home' }),
        spells: Array(12).fill({ name: 'Spell', level: 10, maxLevel: 10, village: 'home' }),
        achievements: Array(50).fill({ name: 'Achievement', stars: 3 }),
        builderHallLevel: 10,
        expLevel: 300,
      };

      const result = extractEnrichedFields(playerDetail);
      expect(Object.keys(result.petLevels!).length).toBe(4);
      expect(result.maxTroopCount).toBe(30);
      expect(result.maxSpellCount).toBe(12);
      expect(result.achievementCount).toBe(50);
      expect(result.achievementScore).toBe(150); // 50 * 3
    });
  });
});

describe('Real-World API Data', () => {
  it('should handle actual warfroggy API response structure', () => {
    // This is based on real API structure from CoC
    const playerDetail = {
      tag: '#G9QVRYC2Y',
      name: 'warfroggy',
      townHallLevel: 13,
      expLevel: 180,
      trophies: 3500,
      bestTrophies: 4200,
      warStars: 387,
      attackWins: 2150,
      defenseWins: 850,
      builderHallLevel: 10,
      versusTrophies: 2800,
      versusBattleWins: 450,
      bestVersusTrophies: 3500,
      clanCapitalContributions: 125000,
      pets: [
        { name: 'L.A.S.S.I', level: 10, maxLevel: 15, village: 'home' },
        { name: 'Electro Owl', level: 8, maxLevel: 15, village: 'home' },
        { name: 'Mighty Yak', level: 5, maxLevel: 15, village: 'home' },
        { name: 'Unicorn', level: 3, maxLevel: 15, village: 'home' },
      ],
      heroEquipment: [
        { name: 'Barbarian Puppet', level: 18, maxLevel: 18, village: 'home' },
        { name: 'Rage Vial', level: 15, maxLevel: 18, village: 'home' },
      ],
      troops: [
        { name: 'Barbarian', level: 11, maxLevel: 11, village: 'home' },
        { name: 'Archer', level: 11, maxLevel: 11, village: 'home' },
        { name: 'Giant', level: 10, maxLevel: 11, village: 'home' },
      ],
      spells: [
        { name: 'Lightning Spell', level: 9, maxLevel: 9, village: 'home' },
        { name: 'Healing Spell', level: 9, maxLevel: 9, village: 'home' },
      ],
      achievements: Array(42).fill({ name: 'Achievement', stars: 3 }),
    };

    const result = extractEnrichedFields(playerDetail);

    // Verify all fields extracted correctly
    expect(result.petLevels).toEqual(expect.objectContaining({ 'L.A.S.S.I': 10 }));
    expect(result.builderHallLevel).toBe(10);
    expect(result.versusTrophies).toBe(2800);
    expect(result.versusBattleWins).toBe(450);
    expect(result.warStars).toBe(387);
    expect(result.attackWins).toBe(2150);
    expect(result.defenseWins).toBe(850);
    expect(result.capitalContributions).toBe(125000);
    expect(result.maxTroopCount).toBe(2);
    expect(result.maxSpellCount).toBe(2);
    expect(result.achievementCount).toBe(42);
    expect(result.achievementScore).toBe(126);
    expect(result.expLevel).toBe(180);
    expect(result.bestTrophies).toBe(4200);
    expect(result.bestVersusTrophies).toBe(3500);
  });
});

