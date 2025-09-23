export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    name: "Simple MCP Test",
    status: "working",
    timestamp: new Date().toISOString()
  });
}
