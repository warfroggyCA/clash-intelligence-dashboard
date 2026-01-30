import { redirect } from 'next/navigation';

// Alias route for older links / future sharing.
// Canonical entry is /home.
export default function ClaimRedirectPage() {
  redirect('/home');
}
