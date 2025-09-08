import { NextRequest, NextResponse } from 'next/server';
import { readDepartures, addDeparture, getActiveDepartures, checkForRejoins, markDepartureResolved } from '../../../lib/departures';

// GET /api/departures?clanTag=#TAG
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clanTag = searchParams.get('clanTag');
    
    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }
    
    const departures = await readDepartures(clanTag);
    
    return NextResponse.json({
      success: true,
      departures
    });
  } catch (error: any) {
    console.error('Error reading departures:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/departures
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clanTag, departure, action } = body;
    
    if (!clanTag) {
      return NextResponse.json({ error: 'Clan tag is required' }, { status: 400 });
    }
    
    if (action === 'add' && departure) {
      await addDeparture(clanTag, departure);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'resolve' && departure?.memberTag) {
      await markDepartureResolved(clanTag, departure.memberTag);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing departures:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
