import SimplePlayerView from './SimplePlayerView';

interface PageProps {
  params: { tag: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SimplePlayerPage({ params }: PageProps) {
  const tag = params?.tag ?? '';
  return <SimplePlayerView tag={tag} />;
}
