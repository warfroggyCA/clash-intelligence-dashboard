import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Check authorization
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const fixieUrl = process.env.FIXIE_URL;
  const disableProxy = process.env.COC_DISABLE_PROXY === 'true';
  const allowProxyFallback = process.env.COC_ALLOW_PROXY_FALLBACK !== 'false';
  const cocApiToken = process.env.COC_API_TOKEN;
  
  // Mask sensitive values
  const maskedFixieUrl = fixieUrl 
    ? fixieUrl.replace(/^https?:\/\/[^:]+:[^@]+@/, 'https://***:***@')
    : null;
  const maskedToken = cocApiToken 
    ? `${cocApiToken.substring(0, 8)}...${cocApiToken.substring(cocApiToken.length - 4)}`
    : null;
  
  return NextResponse.json({
    fixie: {
      url: maskedFixieUrl,
      isSet: !!fixieUrl,
      configured: !!fixieUrl && !disableProxy,
    },
    proxy: {
      disabled: disableProxy,
      allowFallback: allowProxyFallback,
      willUseProxy: !!fixieUrl && !disableProxy,
    },
    cocApi: {
      token: maskedToken,
      isSet: !!cocApiToken,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    }
  });
}

