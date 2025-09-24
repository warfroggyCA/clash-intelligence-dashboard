"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/login?error=' + encodeURIComponent(error.message));
          return;
        }

        if (data.session) {
          // Successful authentication, redirect to dashboard
          router.push('/');
        } else {
          // No session, redirect to login
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        router.push('/login?error=Authentication failed');
      }
    };

    handleAuthCallback();
  }, [supabase.auth, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-gradient-to-br from-clash-gold to-clash-orange rounded-full flex items-center justify-center mb-4 animate-spin">
          <span className="text-2xl">⚔️</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing sign in...
        </h2>
        <p className="text-gray-600">
          Please wait while we authenticate your account.
        </p>
      </div>
    </div>
  );
}
