import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export const dynamic = 'force-dynamic';

/**
 * Diagnostic endpoint to check what IP address Fixie proxy is using.
 * This is critical for whitelisting Fixie IPs in CoC API key settings.
 * 
 * Requires ADMIN_API_KEY authorization.
 */
export async function GET(req: NextRequest) {
  // Check authorization
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.ADMIN_API_KEY || process.env.INGESTION_TRIGGER_KEY;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const fixieUrl = process.env.FIXIE_URL;
  
  if (!fixieUrl) {
    return NextResponse.json({
      error: 'FIXIE_URL not configured',
      fixieConfigured: false
    }, { status: 400 });
  }
  
  try {
    // Test IP services that return the connecting IP
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://api.ipify.org',
      'https://ipv4.icanhazip.com',
      'https://httpbin.org/ip',
    ];
    
    const results: Array<{ service: string; ip?: string; error?: string }> = [];
    
    for (const serviceUrl of ipServices) {
      try {
        const proxyAgent = new HttpsProxyAgent(fixieUrl);
        const response = await axios.get(serviceUrl, {
          httpsAgent: proxyAgent,
          httpAgent: proxyAgent,
          timeout: 10000,
        });
        
        let ip: string | undefined;
        if (typeof response.data === 'string') {
          ip = response.data.trim();
        } else if (response.data?.origin) {
          ip = typeof response.data.origin === 'string' 
            ? response.data.origin.split(',')[0].trim()
            : response.data.origin;
        } else if (response.data?.ip) {
          ip = response.data.ip;
        }
        
        if (ip) {
          results.push({ service: serviceUrl, ip });
        } else {
          results.push({ service: serviceUrl, error: 'Could not parse IP from response' });
        }
      } catch (error: any) {
        results.push({ 
          service: serviceUrl, 
          error: error?.message || 'Request failed' 
        });
      }
    }
    
    // Extract unique IPs
    const uniqueIPs = [...new Set(results.filter(r => r.ip).map(r => r.ip))];
    
    return NextResponse.json({
      fixieConfigured: true,
      fixieUrl: fixieUrl.replace(/^https?:\/\/[^:]+:[^@]+@/, 'https://***:***@'),
      results,
      detectedIPs: uniqueIPs,
      recommendation: uniqueIPs.length > 0 
        ? `Whitelist these IP addresses in your CoC API key settings: ${uniqueIPs.join(', ')}`
        : 'Could not detect Fixie proxy IP addresses. Check Fixie configuration.',
      note: 'Fixie may use multiple IP addresses. Check Fixie dashboard for complete list of egress IPs.'
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to check Fixie IP',
      fixieConfigured: true
    }, { status: 500 });
  }
}
