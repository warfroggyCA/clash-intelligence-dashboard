import PlayerProfileClient from './PlayerProfileClient';

interface PlayerPageProps {
  params: { tag: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PlayerPage({ params }: PlayerPageProps) {
  const tag = params?.tag ?? '';
  return <PlayerProfileClient tag={tag} />;
}
