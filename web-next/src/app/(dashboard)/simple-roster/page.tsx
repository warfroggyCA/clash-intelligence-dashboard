/**
 * Legacy simple roster route.
 * Now that the main dashboard lives at `/`, redirect here for backward compatibility.
 */

import { redirect } from 'next/navigation';

export default function SimpleRosterRedirect() {
  redirect('/app');
}
