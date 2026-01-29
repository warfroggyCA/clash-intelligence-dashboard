import { isValidTag, normalizeTag } from '@/lib/tags';

export interface AddPlayerNotePayload {
  clanTag: string;
  playerTag: string;
  playerName?: string;
  note: string;
  customFields: Record<string, unknown>;
  createdBy: string;
}

export function buildAddPlayerNotePayload({
  clanTag,
  playerTag,
  playerName,
  note,
  createdBy = 'Player Database',
}: {
  clanTag: string;
  playerTag: string;
  playerName?: string;
  note?: string;
  createdBy?: string;
}): { payload: AddPlayerNotePayload | null; error: string | null } {
  const normalizedClanTag = normalizeTag(clanTag);
  const normalizedPlayerTag = normalizeTag(playerTag);

  if (!normalizedPlayerTag || !isValidTag(normalizedPlayerTag)) {
    return {
      payload: null,
      error: 'Player tag is invalid. Please include a # and only use valid characters.',
    };
  }

  if (!normalizedClanTag || !isValidTag(normalizedClanTag)) {
    return {
      payload: null,
      error: 'Clan tag is invalid.',
    };
  }

  const trimmedName = playerName?.trim();
  const trimmedNote = note?.trim();

  return {
    payload: {
      clanTag: normalizedClanTag,
      playerTag: normalizedPlayerTag,
      playerName: trimmedName || undefined,
      note: trimmedNote || 'Player added to database',
      customFields: {},
      createdBy,
    },
    error: null,
  };
}
