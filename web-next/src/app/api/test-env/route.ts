export async function GET() { return Response.json({ allowAnonAccess: process.env.NEXT_PUBLIC_ALLOW_ANON_ACCESS }); }
