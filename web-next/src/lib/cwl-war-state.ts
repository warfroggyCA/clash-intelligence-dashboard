export const normalizeWarState = (state?: string | null): string | null => {
  if (!state) return null;
  const raw = String(state);
  const lower = raw.toLowerCase();
  if (lower === 'warended' || lower === 'ended') return 'warEnded';
  if (lower === 'inwar') return 'inWar';
  if (lower === 'preparation') return 'preparation';
  return raw;
};

export const isWarEnded = (state?: string | null): boolean => {
  return normalizeWarState(state) === 'warEnded';
};
