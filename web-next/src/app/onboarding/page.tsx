import { getActiveClanConfig } from '@/lib/active-clan';
import { OnboardingClient } from './OnboardingClient';
import { AuthGate } from '@/components/layout/AuthGuard';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  const clanConfig = getActiveClanConfig();
  return (
    <AuthGate>
      <OnboardingClient clanConfig={clanConfig} />
    </AuthGate>
  );
}
