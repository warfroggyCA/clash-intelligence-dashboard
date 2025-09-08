import { extractHeroLevels } from '../coc';

describe('extractHeroLevels', () => {
  it('should extract hero levels from currentLevel field', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King', currentLevel: 15 },
        { name: 'Archer Queen', currentLevel: 20 },
        { name: 'Grand Warden', currentLevel: 10 },
        { name: 'Royal Champion', currentLevel: 5 },
        { name: 'Minion Prince', currentLevel: 8 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 15,
      aq: 20,
      gw: 10,
      rc: 5,
      mp: 8
    });
  });

  it('should extract hero levels from level field when currentLevel is missing', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King', level: 12 },
        { name: 'Archer Queen', level: 18 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 12,
      aq: 18,
      gw: null,
      rc: null,
      mp: null
    });
  });

  it('should handle missing heroes array', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer'
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: null,
      aq: null,
      gw: null,
      rc: null,
      mp: null
    });
  });

  it('should handle empty heroes array', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: []
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: null,
      aq: null,
      gw: null,
      rc: null,
      mp: null
    });
  });

  it('should handle unknown hero names', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King', currentLevel: 15 },
        { name: 'Unknown Hero', currentLevel: 10 },
        { name: 'Archer Queen', currentLevel: 20 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 15,
      aq: 20,
      gw: null,
      rc: null,
      mp: null
    });
  });

  it('should handle heroes with null/undefined levels', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King', currentLevel: null },
        { name: 'Archer Queen', level: undefined },
        { name: 'Grand Warden', currentLevel: 0 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 0,
      aq: 0,
      gw: 0,
      rc: null,
      mp: null
    });
  });

  it('should handle case-insensitive hero names', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'barbarian king', currentLevel: 15 },
        { name: 'ARCHER QUEEN', currentLevel: 20 },
        { name: 'Grand Warden', currentLevel: 10 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 15,
      aq: 20,
      gw: 10,
      rc: null,
      mp: null
    });
  });

  it('should handle partial hero names', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King Level 15', currentLevel: 15 },
        { name: 'Archer Queen (Maxed)', currentLevel: 20 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 15,
      aq: 20,
      gw: null,
      rc: null,
      mp: null
    });
  });

  it('should prioritize currentLevel over level when both exist', () => {
    const player = {
      tag: '#TEST123',
      name: 'TestPlayer',
      heroes: [
        { name: 'Barbarian King', currentLevel: 15, level: 10 },
        { name: 'Archer Queen', currentLevel: 20, level: 18 }
      ]
    };

    const result = extractHeroLevels(player);
    
    expect(result).toEqual({
      bk: 15,
      aq: 20,
      gw: null,
      rc: null,
      mp: null
    });
  });
});
