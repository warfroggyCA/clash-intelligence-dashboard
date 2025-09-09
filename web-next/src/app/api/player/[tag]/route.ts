import { NextRequest, NextResponse } from "next/server";
import { getPlayer, extractHeroLevels } from "@/lib/coc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Global rate limiter for CoC API calls (same as roster API)
class CoCRateLimiter {
  private queue: Array<() => void> = [];
  private active = 0;
  private lastRequest = 0;
  private readonly maxConcurrent = 3; // Conservative limit
  private readonly minInterval = 700; // ~85 requests/minute (well under 100/min limit)

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.process();
    });
  }

  release(): void {
    this.active--;
    this.process();
  }

  private process(): void {
    if (this.queue.length === 0 || this.active >= this.maxConcurrent) return;
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      // Wait before processing next request
      const waitTime = this.minInterval - timeSinceLastRequest;
      if (process.env.NODE_ENV === "development") {
        console.log(`[RateLimiter] Waiting ${waitTime}ms before next request (queue: ${this.queue.length}, active: ${this.active})`);
      }
      setTimeout(() => this.process(), waitTime);
      return;
    }

    const resolve = this.queue.shift();
    if (resolve) {
      this.active++;
      this.lastRequest = now;
      if (process.env.NODE_ENV === "development") {
        console.log(`[RateLimiter] Processing request (queue: ${this.queue.length}, active: ${this.active})`);
      }
      resolve();
    }
  }
}

const rateLimiter = new CoCRateLimiter();

export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
) {
  const { tag } = params;
  
  if (!tag) {
    return NextResponse.json({ error: "Player tag is required" }, { status: 400 });
  }

  // Clean the tag (remove # if present)
  const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
  
  try {
    
    console.log(`Fetching player data for tag: ${cleanTag}`);
    console.log(`Rate limiter queue length: ${rateLimiter['queue'].length}, active: ${rateLimiter['active']}`);
    
    await rateLimiter.acquire(); // Acquire a slot from the rate limiter
    console.log(`Acquired rate limiter slot, making API call for tag: ${cleanTag}`);
    
    try {
      const playerData = await getPlayer(cleanTag);
      console.log('Player data fetched successfully:', playerData);
      
      // Extract hero levels the same way the roster API does
      const heroes = extractHeroLevels(playerData);
      const processedPlayerData = {
        ...playerData,
        bk: typeof heroes.bk === "number" ? heroes.bk : null,
        aq: typeof heroes.aq === "number" ? heroes.aq : null,
        gw: typeof heroes.gw === "number" ? heroes.gw : null,
        rc: typeof heroes.rc === "number" ? heroes.rc : null,
        mp: typeof heroes.mp === "number" ? heroes.mp : null,
      };
      
      console.log('Processed player data with heroes:', processedPlayerData);
      return NextResponse.json(processedPlayerData);
    } finally {
      rateLimiter.release(); // Release the slot
    }
  } catch (error: any) {
    console.error('Error fetching player data:', error);
    
    // Provide more specific error messages
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return NextResponse.json(
        { error: `Player with tag #${cleanTag} not found. Please check the tag and try again.` },
        { status: 404 }
      );
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: "API access denied. Please check your API key and IP allowlist." },
        { status: 403 }
      );
    } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch player data" },
      { status: 500 }
    );
  }
}
