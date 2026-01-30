import { getActiveClanConfig } from '@/lib/active-clan';
import { AdminLoginFormClient } from './AdminLoginFormClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const clanConfig = await getActiveClanConfig();
  return <AdminLoginFormClient clanConfig={clanConfig} />;
}
