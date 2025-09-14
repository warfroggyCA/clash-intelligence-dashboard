import { normalizeTag, isValidTag, safeTagForFilename, sanitizeInputTag } from '../lib/tags';

describe('tags utils', () => {
  test('normalizeTag ensures leading # and uppercase', () => {
    expect(normalizeTag('2pr8r8v8p')).toBe('#2PR8R8V8P');
    expect(normalizeTag('#2pr8r8v8p')).toBe('#2PR8R8V8P');
    expect(normalizeTag('  #2pr8r8v8p  ')).toBe('#2PR8R8V8P');
  });

  test('isValidTag respects allowed charset and length', () => {
    expect(isValidTag('#2PR8R8V8P')).toBe(true);
    expect(isValidTag('#INVALID')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });

  test('safeTagForFilename removes # and lowercases', () => {
    expect(safeTagForFilename('#2PR8R8V8P')).toBe('2pr8r8v8p');
  });

  test('sanitizeInputTag cleans user input', () => {
    expect(sanitizeInputTag('  ##2pr8 r8v8p ')).toBe('#2PR8R8V8P');
    const long = '#########################################';
    expect(sanitizeInputTag(long).length).toBeLessThanOrEqual(15);
  });
});

