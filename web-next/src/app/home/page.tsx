import { getPublicRoster } from '../join/get-public-roster';
import JoinClient from '../join/JoinClient';

// /home is the stable entry point for the clan subdomain.
// It shows the public roster picker + in-game token verification flow.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const roster = await getPublicRoster();
  return <JoinClient roster={roster} />;
}
