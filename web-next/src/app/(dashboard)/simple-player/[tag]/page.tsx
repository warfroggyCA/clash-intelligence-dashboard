import SimplePlayerView from './SimplePlayerView';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SimplePlayerPage({ params }: PageProps) {
  const { tag } = await params;
  return <SimplePlayerView tag={tag} />;
}
