// web-next/src/app/api/discord/publish/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from 'zod';
import type { ApiResponse } from '@/types';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';

export async function POST(req: Request) {
  const { logger, json } = createApiContext(req, '/api/discord/publish');
  try {
    const body = await req.json();
    const Schema = z.object({
      webhookUrl: z.string(),
      message: z.string(),
      exhibitType: z.string().optional(),
      clanTag: z.string().optional(),
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Webhook URL and message are required' }, { status: 400 });
    }
    const { webhookUrl, message, exhibitType, clanTag } = parsed.data as any;

    if (!webhookUrl || !message) {
      return json({ success: false, error: "Webhook URL and message are required" }, { status: 400 });
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
        !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
      return json({ success: false, error: "Invalid Discord webhook URL format" }, { status: 400 });
    }

    // Create Discord embed for better formatting
    const embed = {
      title: `📊 Clash Intelligence Report`,
      description: message,
      color: getExhibitColor(exhibitType),
      timestamp: new Date().toISOString(),
      footer: {
        text: `Clash Intelligence Dashboard • ${clanTag || 'Unknown Clan'}`,
        icon_url: "https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoic3VwZXJjZWxsXC9maWxlXC91OGFIS25ZUkpQaXlvVHh5a1Q0OC5wbmcifQ:supercell:8_pSWOLovwldaAWJu_t2Q6C91k6oc7p_mY0m9yar7G0?width=1218&format=webp&quality=100"
      },
      author: {
        name: "Clash Intelligence Dashboard",
        icon_url: "https://cdn-assets-eu.frontify.com/s3/frontify-enterprise-files-eu/eyJwYXRoIjoic3VwZXJjZWxsXC9maWxlXC91OGFIS25ZUkpQaXlvVHh5a1Q0OC5wbmcifQ:supercell:8_pSWOLovwldaAWJu_t2Q6C91k6oc7p_mY0m9yar7G0?width=1218&format=webp&quality=100"
      }
    };

    // Send to Discord webhook
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed]
      }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Discord webhook error:', errorText);
      return json({ success: false, error: `Discord API error: ${discordResponse.status} ${discordResponse.statusText}` }, { status: 500 });
    }

    // Log successful publish (for debugging)
    logger.info('Published to Discord', { exhibitType, clanTag });
    return json({ success: true, data: { message: 'Exhibit published to Discord successfully', exhibitType, clanTag } });

  } catch (error: any) {
    console.error('Discord publish error:', error);
    return json({ success: false, error: error.message || "Failed to publish to Discord" }, { status: 500 });
  }
}

function getExhibitColor(exhibitType: string): number {
  switch (exhibitType) {
    case 'rushed':
      return 0xff4444; // Red
    case 'donations':
      return 0x10b981; // Green
    case 'activity':
      return 0x3b82f6; // Blue
    default:
      return 0x6b7280; // Gray
  }
}
