import type { MemberChange } from '@/lib/snapshots';

export interface AggregatedChange {
  tag: string;
  name: string;
  contributions: string[];
}

export function groupMemberChanges(changes: MemberChange[]): AggregatedChange[] {
  const map = new Map<string, AggregatedChange>();

  const describeChange = (change: MemberChange): string | null => {
    const { type, previousValue, newValue, description } = change;
    const numericDelta =
      typeof newValue === 'number' && typeof previousValue === 'number'
        ? newValue - previousValue
        : null;
    switch (type) {
      case 'trophy_change': {
        const delta =
          numericDelta ??
          (change.description?.match(/(-?\d+)/)?.[0]
            ? parseInt(change.description.match(/(-?\d+)/)![0], 10)
            : 0);
        if (!delta) return null;
        const verb = delta > 0 ? 'gained' : 'lost';
        return `${verb} ${Math.abs(delta)} trophies`;
      }
      case 'hero_upgrade': {
        const hero = (change as any).hero || (change as any).heroName || 'Hero';
        const level = (change as any).newLevel ?? newValue;
        if (!level) return `${hero} upgrade`; 
        return `${hero} → ${level}`;
      }
      case 'town_hall_upgrade': {
        const level = newValue || (change as any).newLevel;
        return level ? `Town Hall → ${level}` : 'Town Hall upgrade';
      }
      case 'donation_change': {
        const delta =
          numericDelta ??
          (description?.match(/(-?\d+)/)?.[0]
            ? parseInt(description.match(/(-?\d+)/)![0], 10)
            : 0);
        if (!delta) return null;
        const monthly = delta >= 1000;
        return delta > 0
          ? `${delta} troops donated${monthly ? ' (heavy support)' : ''}`
          : `${Math.abs(delta)} troops received`;
      }
      case 'donation_received_change': {
        if (!numericDelta) return null;
        return `${Math.abs(numericDelta)} troops received`;
      }
      case 'attack_wins_change': {
        if (!numericDelta) return null;
        return `Attack wins +${numericDelta}`;
      }
      case 'versus_battle_wins_change': {
        if (!numericDelta) return null;
        return `Versus wins +${numericDelta}`;
      }
      case 'versus_trophies_change': {
        if (!numericDelta) return null;
        const verb = numericDelta > 0 ? '+' : '-';
        return `Versus trophies ${verb}${Math.abs(numericDelta)}`;
      }
      case 'capital_contributions_change': {
        if (!numericDelta) return null;
        const formatted = Math.round(numericDelta).toLocaleString();
        return `Capital gold +${formatted}`;
      }
      case 'new_member':
        return 'Joined the clan';
      case 'left_member':
        return 'Departed the clan';
      case 'role_change':
        return `Role → ${newValue}`;
      default:
        return description ? description.replace(/^[-•]\s*/, '').trim() : null;
    }
  };

  for (const change of changes) {
    const tag = change.member.tag;
    const name = change.member.name || tag;
    const existing = map.get(tag) ?? { tag, name, contributions: [] };
    const descriptor = describeChange(change);
    if (descriptor) {
      existing.contributions.push(descriptor);
    }
    map.set(tag, existing);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      contributions: Array.from(new Set(entry.contributions)),
    }))
    .filter((entry) => entry.contributions.length > 0);
}

export function formatAggregatedChange(entry: AggregatedChange): string {
  if (!entry.contributions.length) {
    return entry.name;
  }
  if (entry.contributions.length === 1) {
    return `${entry.name}: ${entry.contributions[0]}`;
  }
  return `${entry.name}: ${entry.contributions.slice(0, 3).join(', ')}${
    entry.contributions.length > 3 ? `, +${entry.contributions.length - 3} more` : ''
  }`;
}
