import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPPORTED_EVENTS = new Set(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT']);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const event = body?.event;
    if (!event || !SUPPORTED_EVENTS.has(event)) {
      return NextResponse.json({ success: true });
    }

    const session = body?.session ?? null;

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set(name, value, options);
          },
          remove(name, options) {
            cookieStore.set(name, '', { ...options, expires: new Date(0) });
          },
        },
      }
    );

    if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        throw error;
      }
    } else if (event === 'SIGNED_OUT') {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[api/auth/callback] Failed to sync session', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to sync session' },
      { status: 500 }
    );
  }
}

