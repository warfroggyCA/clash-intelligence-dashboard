import { getActiveClanConfig } from '@/lib/active-clan';
import RegisterClient from './RegisterClient';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const clanConfig = getActiveClanConfig();
  return <RegisterClient clanConfig={clanConfig} />;
}
