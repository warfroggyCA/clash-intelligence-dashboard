export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const tok = process.env.COC_API_TOKEN || "";
  return NextResponse.json({
    ok: true,
    hasCoC: !!tok,
    tokenLen: tok.length,
    tokenHash: tok ? crypto.createHash("sha256").update(tok).digest("hex").slice(0, 12) : null,
    pid: process.pid,
    cwd: process.cwd(),
    uptimeSec: Math.round(process.uptime())
  });
}

