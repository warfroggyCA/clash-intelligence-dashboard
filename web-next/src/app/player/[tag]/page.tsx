import React from 'react';
import { Metadata } from 'next';
import { fetchPlayerProfile, normalizePlayerTag } from '@/lib/player-profile';
import PlayerProfilePage from '@/components/player/PlayerProfilePage';
import { notFound } from 'next/navigation';

interface PlayerPageProps {
  params: {
    tag: string;
  };
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const normalizedTag = normalizePlayerTag(params.tag);
  const profile = await fetchPlayerProfile(normalizedTag);

  return {
    title: `${profile.summary.name} • Player Profile`,
    description: `Analytics and leadership insights for ${profile.summary.name} (${profile.summary.tag}).`,
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const normalizedTag = normalizePlayerTag(params.tag);
  const data = await fetchPlayerProfile(normalizedTag);

  if (!data) {
    notFound();
  }

  return (
    <div className="player-profile-page space-y-6">
      <PlayerProfilePage data={data} />
    </div>
  );
}
