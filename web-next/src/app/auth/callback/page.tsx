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
        const currentUrl = new URL(window.location.href);
        const code = currentUrl.searchParams.get('code');

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) {
            throw error || new Error('Invalid session exchange');
          }
          router.replace('/app');
          return;
        }

        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error || !data.session) {
              throw error || new Error('Unable to set session');
            }
            router.replace('/app');
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        if (data.session) {
          router.replace('/app');
          return;
        }

        router.replace('/login?error=Sign%20in%20required');
      } catch (err) {
        console.error('Auth callback error:', err);
        router.replace('/login?error=Authentication%20failed');
      }
    };

    void handleAuthCallback();
  }, [supabase, router]);

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
