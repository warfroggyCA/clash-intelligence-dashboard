import { buildAddPlayerNotePayload } from '../add-player';

describe('buildAddPlayerNotePayload', () => {
  it('normalizes tags and defaults the note', () => {
    const result = buildAddPlayerNotePayload({
      clanTag: ' #2PR8R8V8P ',
      playerTag: '299PGYLG',
      playerName: ' flame ',
      note: ' ',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual({
      clanTag: '#2PR8R8V8P',
      playerTag: '#299PGYLG',
      playerName: 'flame',
      note: 'Player added to database',
      customFields: {},
      createdBy: 'Player Database',
    });
  });

  it('rejects invalid player tags', () => {
    const result = buildAddPlayerNotePayload({
      clanTag: '#2PR8R8V8P',
      playerTag: 'INVALID',
      playerName: 'Test',
      note: 'note',
    });

    expect(result.payload).toBeNull();
    expect(result.error).toBe('Player tag is invalid. Please include a # and only use valid characters.');
  });
});
