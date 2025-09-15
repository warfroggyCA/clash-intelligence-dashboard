import { NextRequest, NextResponse } from 'next/server';
import { ClanAccessConfig, AccessMember, generateAccessPassword } from '../../../../lib/access-management';
import { z } from 'zod';
import type { ApiResponse } from '@/types';

// This would be stored in Supabase in production
let accessConfigs: Map<string, ClanAccessConfig> = new Map();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const Schema = z.object({ clanTag: z.string(), clanName: z.string(), ownerName: z.string(), ownerCocTag: z.string().optional() });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Clan tag, clan name, and owner name are required' }, { status: 400 });
    }
    const { clanTag, clanName, ownerName, ownerCocTag } = parsed.data as any;

    // Check if access config already exists
    if (accessConfigs.has(clanTag.toUpperCase())) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access configuration already exists for this clan' }, { status: 409 });
    }

    // Create owner access member
    const ownerPassword = generateAccessPassword();
    const ownerMember: AccessMember = {
      id: `owner_${Date.now()}`,
      name: ownerName,
      cocPlayerTag: ownerCocTag,
      accessLevel: 'leader',
      password: ownerPassword,
      createdAt: new Date().toISOString(),
      isActive: true,
      addedBy: 'System',
      notes: 'Clan owner - full access'
    };

    // Create access configuration
    const accessConfig: ClanAccessConfig = {
      clanTag: clanTag.toUpperCase(),
      clanName,
      ownerId: ownerMember.id,
      accessMembers: [ownerMember],
      settings: {
        allowSelfRegistration: false,
        requireEmailVerification: false,
        defaultAccessLevel: 'member'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store the configuration
    accessConfigs.set(clanTag.toUpperCase(), accessConfig);

    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Access configuration created successfully', ownerAccess: { name: ownerName, accessLevel: 'leader', password: ownerPassword, instructions: `Share this password with clan members: ${ownerPassword}` }, clanInfo: { clanTag: accessConfig.clanTag, clanName: accessConfig.clanName } } });

  } catch (error) {
    console.error('Error initializing access:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const Schema = z.object({ clanTag: z.string() });
    const parsed = Schema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Clan tag required' }, { status: 400 });
    }
    const clanTag = parsed.data.clanTag;

    const config = accessConfigs.get(clanTag.toUpperCase());
    if (!config) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No access configuration found for this clan' }, { status: 404 });
    }

    // Return basic info (without sensitive data)
    return NextResponse.json<ApiResponse>({ success: true, data: { exists: true, clanInfo: { clanTag: config.clanTag, clanName: config.clanName, memberCount: config.accessMembers.filter(m => m.isActive).length, createdAt: config.createdAt } } });

  } catch (error) {
    console.error('Error checking access config:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
