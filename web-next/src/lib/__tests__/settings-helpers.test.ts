import { buildClanTagError, normalizeClanTagInput } from '@/lib/settings-helpers';

describe('settings helpers', () => {
  it('returns null for empty inputs', () => {
    expect(normalizeClanTagInput('')).toBeNull();
    expect(normalizeClanTagInput('   ')).toBeNull();
  });

  it('normalizes valid clan tags', () => {
    expect(normalizeClanTagInput('#2pr8r8v8p')).toBe('#2PR8R8V8P');
    expect(normalizeClanTagInput('2pr8r8v8p')).toBe('#2PR8R8V8P');
  });

  it('builds validation errors for invalid tags', () => {
    expect(buildClanTagError('')).toBe('Enter a clan tag');
    expect(buildClanTagError('abc')).toBe('Enter a valid clan tag (e.g., #2PR8R8V8P)');
  });

  it('returns no error for valid tags', () => {
    expect(buildClanTagError('#2PR8R8V8P')).toBeNull();
  });
});
