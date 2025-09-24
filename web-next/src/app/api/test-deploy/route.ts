import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Deployment test successful",
    timestamp: new Date().toISOString(),
    fixieUrl: process.env.FIXIE_URL ? "PRESENT" : "NOT_PRESENT",
    cocToken: process.env.COC_API_TOKEN ? "PRESENT" : "NOT_PRESENT"
  });
}
