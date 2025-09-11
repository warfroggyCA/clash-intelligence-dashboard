import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    // Make a test request to see what IP we're using
    const testResponse = await fetch('https://httpbin.org/ip');
    const ipData = await testResponse.json();
    
    return NextResponse.json({
      ok: true,
      headers: {
        'x-forwarded-for': forwarded,
        'x-real-ip': realIp,
        'cf-connecting-ip': cfConnectingIp,
      },
      actualIp: ipData.origin,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

