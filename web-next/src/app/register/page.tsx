import { getActiveClanConfig } from '@/lib/active-clan';
import RegisterClient from './RegisterClient';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const clanConfig = await getActiveClanConfig();
  return <RegisterClient clanConfig={clanConfig} />;
}
