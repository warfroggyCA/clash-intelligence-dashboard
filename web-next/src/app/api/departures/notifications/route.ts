import { NextRequest, NextResponse } from 'next/server';
import { checkForRejoins, getActiveDepartures } from '../../../../lib/departures';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/departures/notifications?clanTag=#TAG
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    
    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }
    
    // Get current members from the roster API
    const rosterResponse = await fetch(`${request.nextUrl.origin}/api/roster?mode=live&clanTag=${encodeURIComponent(clanTag)}`);
    const rosterData = await rosterResponse.json();
    
    if (!rosterData.members) {
      return NextResponse.json({ error: 'Failed to fetch current members' }, { status: 500 });
    }
    
    const currentMembers = rosterData.members.map((m: any) => ({
      tag: m.tag,
      name: m.name
    }));
    
    // Check for rejoins
    const rejoins = await checkForRejoins(clanTag, currentMembers);
    
    // Get active departures
    const activeDepartures = await getActiveDepartures(clanTag, currentMembers);
    
    return NextResponse.json({
      success: true,
      rejoins,
      activeDepartures,
      hasNotifications: rejoins.length > 0 || activeDepartures.length > 0
    });
  } catch (error: any) {
    console.error('Error checking departure notifications:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
