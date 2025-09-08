export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

async function fetchText(url: string, timeoutMs = 4000): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ac.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.text()).trim();
  } finally {
    clearTimeout(t);
  }
}

async function getOutboundIp(): Promise<{ ip?: string; source?: string; error?: string }>{
  // Try a couple of common IPv4 echo services
  const attempts = [
    { url: "https://api.ipify.org", parse: (t: string) => t, source: "api.ipify.org" },
    { url: "https://ipv4.icanhazip.com", parse: (t: string) => t, source: "ipv4.icanhazip.com" },
  ];
  for (const a of attempts) {
    try {
      const txt = await fetchText(a.url);
      const ip = a.parse(txt).split("\n")[0].trim();
      if (ip) return { ip, source: a.source };
    } catch (e: any) {
      // try next
    }
  }
  return { error: "failed to resolve outbound ip" };
}

export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "Not available in production" }, { status: 404 });
    }

    const headers = new Headers(req.headers);
    const xff = headers.get("x-forwarded-for") || undefined;
    const xri = headers.get("x-real-ip") || undefined;
    const { ip, source, error } = await getOutboundIp();

    return NextResponse.json({
      ok: true,
      env: process.env.NODE_ENV,
      outbound: { ip, source, error },
      request: { xForwardedFor: xff, xRealIp: xri }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}


