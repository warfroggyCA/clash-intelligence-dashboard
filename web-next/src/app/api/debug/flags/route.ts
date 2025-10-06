import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const flags = {
    NEXT_PUBLIC_DISABLE_SHADOW_PORTAL: process.env.NEXT_PUBLIC_DISABLE_SHADOW_PORTAL || null,
    NEXT_PUBLIC_DISABLE_TOOLTIP_MANAGER: process.env.NEXT_PUBLIC_DISABLE_TOOLTIP_MANAGER || null,
    NEXT_PUBLIC_DISABLE_RETURNING_REVIEW: process.env.NEXT_PUBLIC_DISABLE_RETURNING_REVIEW || null,
    NEXT_PUBLIC_DISABLE_AUTO_REFRESH: process.env.NEXT_PUBLIC_DISABLE_AUTO_REFRESH || null,
    NEXT_PUBLIC_SAFE_MODE: process.env.NEXT_PUBLIC_SAFE_MODE || null,
    NEXT_PUBLIC_RS_DISABLE_STATS: process.env.NEXT_PUBLIC_RS_DISABLE_STATS || null,
    NEXT_PUBLIC_RS_DISABLE_WAR: process.env.NEXT_PUBLIC_RS_DISABLE_WAR || null,
    NEXT_PUBLIC_RS_DISABLE_HIGHLIGHTS: process.env.NEXT_PUBLIC_RS_DISABLE_HIGHLIGHTS || null,
    NEXT_PUBLIC_RS_DISABLE_MODAL: process.env.NEXT_PUBLIC_RS_DISABLE_MODAL || null,
    NEXT_PUBLIC_DISABLE_ACE_IN_SUMMARY: process.env.NEXT_PUBLIC_DISABLE_ACE_IN_SUMMARY || null,
    NEXT_PUBLIC_RS_DEBUG_LOG: process.env.NEXT_PUBLIC_RS_DEBUG_LOG || null,
  };
  const meta = {
    NODE_ENV: process.env.NODE_ENV || null,
    VERCEL: process.env.VERCEL || null,
    COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || null,
  };
  return NextResponse.json({ success: true, flags, meta });
}

