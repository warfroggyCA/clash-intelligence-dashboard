import { detectChanges, DailySnapshot } from '../lib/snapshots';

function snapshotFor(date: string, members: Array<Partial<DailySnapshot['members'][number]>>) : DailySnapshot {
  return {
    date,
    clanTag: '#TESTTAG',
    timestamp: new Date().toISOString(),
    members: members.map((m) => ({ name: 'X', tag: '#AAAAAAA', ...m })) as any,
    memberCount: members.length as number,
    totalTrophies: 0,
    totalDonations: 0,
  };
}

describe('detectChanges', () => {
  test('detects left_member and new_member with mixed-case tags', () => {
    const prev = snapshotFor('2025-09-13', [
      { name: 'Alpha', tag: '#abc123' },
      { name: 'Bravo', tag: '#DEF456' },
    ]);
    const curr = snapshotFor('2025-09-14', [
      // Alpha left; Charlie joined
      { name: 'Bravo', tag: '#def456' },
      { name: 'Charlie', tag: '#GHI789' },
    ]);

    const changes = detectChanges(prev, curr);
    const types = changes.map(c => c.type);
    expect(types).toContain('left_member');
    expect(types).toContain('new_member');
  });

  test('detects hero upgrade only when level increases', () => {
    const prev = snapshotFor('2025-09-13', [
      { name: 'HeroGuy', tag: '#HERO123', bk: 50 }
    ]);
    const curr = snapshotFor('2025-09-14', [
      { name: 'HeroGuy', tag: '#hero123', bk: 51 }
    ]);
    const changes = detectChanges(prev, curr);
    expect(changes.find(c => c.type === 'hero_upgrade')).toBeTruthy();
  });
});

