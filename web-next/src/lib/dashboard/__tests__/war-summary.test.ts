import { buildWarChatBlurb } from '../war-summary';

describe('buildWarChatBlurb', () => {
  it('formats a planning war summary with opponent and size', () => {
    const result = buildWarChatBlurb({
      isActive: true,
      state: 'preparation',
      opponentName: 'Test Opponent',
      teamSize: 15,
      stateLabel: 'Planning',
    });

    expect(result).toContain('War vs Test Opponent');
    expect(result).toContain('15v15');
    expect(result).toContain('Planning');
  });

  it('handles missing opponent gracefully', () => {
    const result = buildWarChatBlurb({
      isActive: false,
      state: null,
      opponentName: null,
      teamSize: null,
      stateLabel: 'No active war',
    });

    expect(result).toContain('No active war');
  });
});
