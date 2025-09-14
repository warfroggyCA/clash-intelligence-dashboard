import { parseTenureLedger } from '../lib/tenure';

describe('parseTenureLedger', () => {
  test('uses latest ts per tag and adds days to target date', () => {
    const lines = [
      JSON.stringify({ tag: '#PQL222', base: 10, as_of: '2025-09-10', ts: '2025-09-10T01:00:00Z' }),
      JSON.stringify({ tag: '#pql222', base: 12, as_of: '2025-09-11', ts: '2025-09-11T01:00:00Z' }),
      JSON.stringify({ tag: '#GRJ289', tenure_days: 5, as_of: '2025-09-12', ts: '2025-09-12T01:00:00Z' }),
    ];
    const map = parseTenureLedger(lines, '2025-09-14');
    // For PQL222, latest is base=12 on 2025-09-11; days to 14th = 3 => 15
    expect(map['#PQL222']).toBe(15);
    // For GRJ289, base from tenure_days=5 on 2025-09-12; +2 => 7
    expect(map['#GRJ289']).toBe(7);
  });

  test('ignores invalid lines and tags', () => {
    const lines = [
      '{ not json',
      JSON.stringify({ tag: 'INVALID', base: 10, as_of: '2025-09-10', ts: '2025-09-10T01:00:00Z' }),
    ];
    const map = parseTenureLedger(lines);
    expect(Object.keys(map).length).toBe(0);
  });
});
