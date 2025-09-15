export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export async function GET() {
  const hasCoC = !!process.env.COC_API_TOKEN;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  return NextResponse.json<ApiResponse>({ success: true, data: { hasCoC, hasOpenAI } });
}
