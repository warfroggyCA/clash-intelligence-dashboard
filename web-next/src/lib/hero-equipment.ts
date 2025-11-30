/**
 * Clash of Clans Hero Equipment Reference
 *
 * Hero Equipment allows Heroes to modify their stats and abilities during battle.
 * Each Hero can equip up to two pieces of equipment at a time.
 *
 * Rarity levels:
 * - Common: max level 18
 * - Epic: max level 27
 *
 * Equipment is upgraded in the Blacksmith using Ores.
 */

export type EquipmentRarity = 'Common' | 'Epic';

export interface HeroEquipment {
  name: string;
  rarity: EquipmentRarity;
  maxLevel: number;
  description: string;
  wikiUrl: string;
}

export interface HeroEquipmentSet {
  hero: string;
  equipment: HeroEquipment[];
}

export const EQUIPMENT_MAX_LEVELS: Record<EquipmentRarity, number> = {
  Common: 18,
  Epic: 27,
};

export const heroEquipmentData: HeroEquipmentSet[] = [
  {
    hero: 'Barbarian King',
    equipment: [
      {
        name: 'Barbarian Puppet',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Summons a pack of raged Barbarians when the King uses his ability. The summoned Barbarians deal extra damage and move faster while enraged.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Barbarian_Puppet',
      },
      {
        name: 'Rage Vial',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Casts Rage on the Barbarian King, increasing his damage output and movement speed when he uses his ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Rage_Vial',
      },
      {
        name: 'Earthquake Boots',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Causes a powerful earthquake which destroys Walls and damages Buildings when the King uses his ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Earthquake_Boots',
      },
      {
        name: 'Vampstache',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Every time the Barbarian King attacks, he heals himself. Provides lifesteal on every attack.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Vampstache',
      },
      {
        name: 'Giant Gauntlet',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Barbarian King becomes gigantic, doing area damage and taking less damage for the duration of the ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Giant_Gauntlet',
      },
      {
        name: 'Spiky Ball',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Shoots a Spiky Ball which bounces between buildings, damaging each building hit.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Spiky_Ball',
      },
      {
        name: 'Snake Bracelet',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Summons snakes that fight by your side when taking damage. The snakes assist in battle.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Snake_Bracelet',
      },
    ],
  },
  {
    hero: 'Archer Queen',
    equipment: [
      {
        name: 'Archer Puppet',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Summons a group of Archers when the Queen uses her ability to assist in battle.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Archer_Puppet',
      },
      {
        name: 'Invisibility Vial',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Makes the Archer Queen invisible, allowing her to avoid targeting and move undetected during her ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Invisibility_Vial',
      },
      {
        name: 'Giant Arrow',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Fires a massive arrow at a target building, dealing significant damage to a single structure.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Giant_Arrow',
      },
      {
        name: 'Healer Puppet',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Summons Healers to support the Archer Queen, providing healing over time during her ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Healer_Puppet',
      },
      {
        name: 'Frozen Arrow',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Shoots arrows that slow down all targets hit, applying a movement speed reduction effect.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Frozen_Arrow',
      },
      {
        name: 'Magic Mirror',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Creates clones of the Archer Queen that fight alongside her during the ability duration.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Magic_Mirror',
      },
      {
        name: 'Action Figure',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Summons a Giant Giant (supersized Giant troop) to assist in the attack.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Action_Figure',
      },
    ],
  },
  {
    hero: 'Minion Prince',
    equipment: [
      {
        name: 'Henchmen Puppet',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Summons Henchmen troops to fight alongside the Minion Prince when he uses his ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Henchmen_Puppet',
      },
      {
        name: 'Dark Orb',
        rarity: 'Common',
        maxLevel: 18,
        description: 'Fires dark energy orbs that deal damage to targets.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Dark_Orb',
      },
      {
        name: 'Metal Pants',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Provides damage reduction to the Minion Prince, making him tankier in battle.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Metal_Pants',
      },
      {
        name: 'Noble Iron',
        rarity: 'Common',
        maxLevel: 18,
        description:
          "Enhances the Minion Prince's range and damage, turning him into a Super Minion during his ability.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Noble_Iron',
      },
      {
        name: 'Dark Crown',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          "Increases the Minion Prince's health and damage when troops are defeated, scaling power during battle.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Dark_Crown',
      },
      {
        name: 'Meteor Staff',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Summons meteors that crash down on the battlefield, dealing splash damage to defenses and troops.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Meteor_Staff',
      },
    ],
  },
  {
    hero: 'Grand Warden',
    equipment: [
      {
        name: 'Eternal Tome',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Grants invulnerability to the Grand Warden and all nearby troops for a duration when his ability is activated.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Eternal_Tome',
      },
      {
        name: 'Life Gem',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Provides healing to the Grand Warden and nearby troops during his ability.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Life_Gem',
      },
      {
        name: 'Rage Gem',
        rarity: 'Common',
        maxLevel: 18,
        description:
          "Applies a rage buff to all nearby troops, increasing their damage output during the Warden's ability.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Rage_Gem',
      },
      {
        name: 'Healing Tome',
        rarity: 'Common',
        maxLevel: 18,
        description:
          "Continuously heals troops in the Warden's aura over the duration of his ability.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Healing_Tome',
      },
      {
        name: 'Fireball',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Launches a fireball that deals massive splash damage to defenses, useful for eliminating key structures.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Fireball',
      },
      {
        name: 'Lavaloon Puppet',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Summons a Lavaloon (Lava Hound + Balloon hybrid unit) and Lavaloon Pups to assist in air attacks.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Lavaloon_Puppet',
      },
      {
        name: 'Heroic Torch',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          "Enhances the Grand Warden's offensive capabilities, providing additional combat power during his ability.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Heroic_Torch',
      },
    ],
  },
  {
    hero: 'Royal Champion',
    equipment: [
      {
        name: 'Royal Gem',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Provides a DPS increase and HP enhancement to the Royal Champion, boosting her combat stats.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Royal_Gem',
      },
      {
        name: 'Seeking Shield',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Throws a seeking shield that targets multiple defenses automatically, providing reliable ranged damage.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Seeking_Shield',
      },
      {
        name: 'Hog Rider Puppet',
        rarity: 'Common',
        maxLevel: 18,
        description:
          'Summons Hog Riders to assist the Royal Champion, providing additional ground troop support and brief invisibility.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Hog_Rider_Puppet',
      },
      {
        name: 'Haste Vial',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Provides a multiplicative speed boost to the Royal Champion, enabling rapid destruction and enhanced mobility.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Haste_Vial',
      },
      {
        name: 'Rocket Spear',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          'Fires a long-range rocket spear with splash damage, effective for sniping defenses from 10 tiles away.',
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Rocket_Spear',
      },
      {
        name: 'Electro Boots',
        rarity: 'Epic',
        maxLevel: 27,
        description:
          "Enhances the Royal Champion's mobility with chain lightning effects, providing speed and protection despite recent nerfs.",
        wikiUrl: 'https://clashofclans.fandom.com/wiki/Electro_Boots',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for lookups
// ─────────────────────────────────────────────────────────────────────────────

/** Flat list of all equipment across all heroes */
export const allEquipment: HeroEquipment[] = heroEquipmentData.flatMap((h) => h.equipment);

/** Map of equipment name (lowercase) → equipment data for fast lookups */
const equipmentByNameMap = new Map<string, HeroEquipment>(
  allEquipment.map((eq) => [eq.name.toLowerCase(), eq])
);

/** Map of equipment name (lowercase) → hero name */
const equipmentToHeroMap = new Map<string, string>(
  heroEquipmentData.flatMap((h) =>
    h.equipment.map((eq) => [eq.name.toLowerCase(), h.hero] as const)
  )
);

/**
 * Get equipment by name (case-insensitive)
 */
export function getEquipmentByName(name: string): HeroEquipment | undefined {
  return equipmentByNameMap.get(name.toLowerCase());
}

/**
 * Get the hero that owns a piece of equipment (case-insensitive)
 */
export function getHeroForEquipment(equipmentName: string): string | undefined {
  return equipmentToHeroMap.get(equipmentName.toLowerCase());
}

/**
 * Get all equipment for a specific hero (case-insensitive)
 */
export function getEquipmentForHero(heroName: string): HeroEquipment[] {
  const normalized = heroName.toLowerCase();
  const heroSet = heroEquipmentData.find((h) => h.hero.toLowerCase() === normalized);
  return heroSet?.equipment ?? [];
}

/**
 * Get equipment filtered by rarity
 */
export function getEquipmentByRarity(rarity: EquipmentRarity): HeroEquipment[] {
  return allEquipment.filter((eq) => eq.rarity === rarity);
}

/**
 * List of all equipment names (for autocomplete, validation, etc.)
 */
export const allEquipmentNames: string[] = allEquipment.map((eq) => eq.name);

/**
 * List of all hero names that have equipment
 */
export const heroNames: string[] = heroEquipmentData.map((h) => h.hero);

