import { getActiveClanConfig } from '@/lib/active-clan';
import { OnboardingClient } from './OnboardingClient';
import { AuthGate } from '@/components/layout/AuthGuard';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const clanConfig = await getActiveClanConfig();
  return (
    <AuthGate>
      <OnboardingClient clanConfig={clanConfig} />
    </AuthGate>
  );
}
