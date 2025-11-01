import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/coc';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * Batch fetch player names from Clash of Clans API
 * Accepts comma-separated list of player tags
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tagsParam = searchParams.get('tags');
    
    if (!tagsParam) {
      return NextResponse.json({ success: false, error: 'tags parameter is required' }, { status: 400 });
    }

    const tags = tagsParam.split(',').map(tag => normalizeTag(tag.trim())).filter(Boolean);
    
    // Filter out invalid test tags and invalid tags
    const validTags = tags.filter(tag => {
      const upperTag = tag.toUpperCase();
      if (upperTag.includes('TEST')) return false;
      return isValidTag(tag);
    });
    
    if (validTags.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    console.log(`[coc-player-names] Fetching names for ${validTags.length} tags from Clash API`);

    const nameMap: Record<string, string> = {};
    const errors: string[] = [];

    // Fetch player names sequentially with rate limiting
    for (const tag of validTags) {
      try {
        // Use rate limiter to respect CoC API limits
        await rateLimiter.acquire();
        
        try {
          const cleanTag = tag.replace('#', '');
          const playerData = await getPlayer(cleanTag);
          
          if (playerData?.name && playerData?.tag) {
            const normalizedTag = normalizeTag(playerData.tag);
            nameMap[normalizedTag] = playerData.name;
            console.log(`[coc-player-names] ✅ ${normalizedTag} → ${playerData.name}`);
          } else {
            errors.push(`${tag}: No name in response`);
          }
        } finally {
          rateLimiter.release();
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        errors.push(`${tag}: ${errorMsg}`);
        console.error(`[coc-player-names] ❌ Failed to fetch ${tag}:`, errorMsg);
        
        // If it's a 404, that's okay - player might not exist
        // If it's rate limiting, we should stop
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
          console.warn(`[coc-player-names] Rate limit hit, stopping batch fetch`);
          break;
        }
      }
    }

    console.log(`[coc-player-names] Successfully fetched ${Object.keys(nameMap).length} names, ${errors.length} errors`);

    // Return as array of objects
    const result = Object.entries(nameMap).map(([tag, name]) => ({
      tag,
      name,
    }));

    return NextResponse.json({ 
      success: true, 
      data: result,
      meta: {
        requested: validTags.length,
        resolved: result.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 5) // Limit error details
      }
    });
  } catch (error: any) {
    console.error('Error in coc-player-names API:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

