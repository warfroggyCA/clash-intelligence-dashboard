import { randomUUID } from 'crypto';
import { cfg } from '@/lib/config';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { AccessLevel } from '@/lib/access-management';
import { generateAccessPassword, hashAccessPassword, passwordsMatch } from '@/lib/server/access-password';

export interface AccessMemberRecord {
  id: string;
  name: string;
  accessLevel: AccessLevel;
  cocPlayerTag?: string | null;
  email?: string | null;
  notes?: string | null;
  addedBy?: string | null;
  createdAt: string;
  lastAccessed?: string | null;
  isActive: boolean;
}

export interface AccessConfigRecord {
  clanTag: string;
  clanName: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateConfigParams {
  clanTag: string;
  clanName: string;
  ownerName: string;
  ownerCocTag?: string;
}

interface AddMemberParams {
  clanTag: string;
  name: string;
  accessLevel: AccessLevel;
  addedBy: string;
  cocPlayerTag?: string;
  email?: string;
  notes?: string;
}

interface UpdateMemberParams {
  clanTag: string;
  memberId: string;
  updates: Partial<Pick<AddMemberParams, 'name' | 'accessLevel' | 'cocPlayerTag' | 'email' | 'notes'>>;
}

function isSupabaseAvailable(): boolean {
  if (process.env.ACCESS_SERVICE_FORCE_MEMORY === 'true') {
    return false;
  }
  return (
    cfg.useSupabase &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
  );
}
const memoryStore = new Map<string, MemoryAccessConfig>();

interface MemoryAccessConfig {
  clanTag: string;
  clanName: string;
  createdAt: string;
  updatedAt: string;
  members: Map<string, MemoryAccessMember>;
}

interface MemoryAccessMember {
  id: string;
  name: string;
  accessLevel: AccessLevel;
  passwordHash: string;
  cocPlayerTag?: string;
  email?: string;
  notes?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt?: string;
  lastAccessed?: string;
  isActive: boolean;
}

function toSanitizedMember(member: MemoryAccessMember): AccessMemberRecord {
  return {
    id: member.id,
    name: member.name,
    accessLevel: member.accessLevel,
    cocPlayerTag: member.cocPlayerTag,
    email: member.email,
    notes: member.notes,
    addedBy: member.addedBy,
    createdAt: member.createdAt,
    lastAccessed: member.lastAccessed,
    isActive: member.isActive,
  };
}

function normalizeClanTag(tag: string): string {
  const normalized = normalizeTag(tag);
  if (!normalized) {
    throw new Error('Invalid clan tag');
  }
  return normalized;
}

function getMemoryConfig(clanTag: string): MemoryAccessConfig | undefined {
  return memoryStore.get(clanTag);
}

function ensureMemoryConfig(clanTag: string, clanName: string): MemoryAccessConfig {
  const existing = getMemoryConfig(clanTag);
  if (existing) return existing;
  const now = new Date().toISOString();
  const config: MemoryAccessConfig = {
    clanTag,
    clanName,
    createdAt: now,
    updatedAt: now,
    members: new Map(),
  };
  memoryStore.set(clanTag, config);
  return config;
}

function sanitizeDbMember(row: any): AccessMemberRecord {
  return {
    id: row.id,
    name: row.name,
    accessLevel: row.access_level as AccessLevel,
    cocPlayerTag: row.player_tag,
    email: row.email,
    notes: row.notes,
    addedBy: row.added_by,
    createdAt: row.created_at,
    lastAccessed: row.last_accessed,
    isActive: row.is_active,
  };
}

async function createConfigSupabase(params: CreateConfigParams) {
  const supabase = getSupabaseAdminClient();
  const clanTag = normalizeClanTag(params.clanTag);
  const { data: existing } = await supabase
    .from('clan_access_configs')
    .select('id')
    .eq('clan_tag', clanTag)
    .maybeSingle();
  if (existing) {
    throw new Error('Access configuration already exists for this clan');
  }

  const { data: configRow, error: configError } = await supabase
    .from('clan_access_configs')
    .insert({ clan_tag: clanTag, clan_name: params.clanName })
    .select('*')
    .single();
  if (configError) {
    throw new Error(`Failed to create access configuration: ${configError.message}`);
  }

  const ownerPassword = generateAccessPassword();
  const passwordHash = hashAccessPassword(ownerPassword);
  const { data: memberRow, error: memberError } = await supabase
    .from('clan_access_members')
    .insert({
      config_id: configRow.id,
      clan_tag: clanTag,
      name: params.ownerName,
      player_tag: params.ownerCocTag || null,
      access_level: 'leader',
      password_hash: passwordHash,
      notes: 'Clan owner - full access',
      added_by: 'system',
    })
    .select('*')
    .single();
  if (memberError) {
    await supabase.from('clan_access_configs').delete().eq('id', configRow.id);
    throw new Error(`Failed to create owner access member: ${memberError.message}`);
  }

  return {
    config: {
      clanTag,
      clanName: params.clanName,
      createdAt: configRow.created_at,
      updatedAt: configRow.updated_at,
    } as AccessConfigRecord,
    ownerMember: sanitizeDbMember(memberRow),
    ownerPassword,
  };
}

function createConfigMemory(params: CreateConfigParams) {
  const clanTag = normalizeClanTag(params.clanTag);
  if (memoryStore.has(clanTag)) {
    throw new Error('Access configuration already exists for this clan');
  }
  const config = ensureMemoryConfig(clanTag, params.clanName);
  const ownerPassword = generateAccessPassword();
  const ownerMember: MemoryAccessMember = {
    id: randomUUID(),
    name: params.ownerName,
    accessLevel: 'leader',
    passwordHash: hashAccessPassword(ownerPassword),
    cocPlayerTag: params.ownerCocTag,
    notes: 'Clan owner - full access',
    addedBy: 'system',
    createdAt: config.createdAt,
    isActive: true,
  };
  config.members.set(ownerMember.id, ownerMember);
  return {
    config: {
      clanTag,
      clanName: params.clanName,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    } as AccessConfigRecord,
    ownerMember: toSanitizedMember(ownerMember),
    ownerPassword,
  };
}

export async function createAccessConfig(params: CreateConfigParams) {
  if (isSupabaseAvailable()) {
    return createConfigSupabase(params);
  }
  return createConfigMemory(params);
}

async function fetchMembersSupabase(clanTag: string) {
  const supabase = getSupabaseAdminClient();
  const { data: configRow, error: configError } = await supabase
    .from('clan_access_configs')
    .select('id, clan_name, created_at, updated_at')
    .eq('clan_tag', clanTag)
    .maybeSingle();
  if (configError) {
    throw new Error(`Failed to load access configuration: ${configError.message}`);
  }
  if (!configRow) {
    return null;
  }
  const { data: memberRows, error: memberError } = await supabase
    .from('clan_access_members')
    .select('*')
    .eq('config_id', configRow.id)
    .order('created_at', { ascending: true });
  if (memberError) {
    throw new Error(`Failed to load access members: ${memberError.message}`);
  }
  return {
    config: {
      clanTag,
      clanName: configRow.clan_name,
      createdAt: configRow.created_at,
      updatedAt: configRow.updated_at,
    } as AccessConfigRecord,
    configId: configRow.id,
    members: (memberRows || []).map((row: any) => ({
      raw: row,
      sanitized: sanitizeDbMember(row),
    })),
  };
}

function fetchMembersMemory(clanTag: string) {
  const config = memoryStore.get(clanTag);
  if (!config) return null;
  const members = Array.from(config.members.values()).map((member) => ({
    raw: member,
    sanitized: toSanitizedMember(member),
  }));
  return {
    config: {
      clanTag,
      clanName: config.clanName,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    } as AccessConfigRecord,
    configId: clanTag,
    members,
  };
}

export async function listAccessMembers(clanTag: string) {
  const normalized = normalizeClanTag(clanTag);
  const data = isSupabaseAvailable()
    ? await fetchMembersSupabase(normalized)
    : fetchMembersMemory(normalized);
  if (!data) {
    throw new Error('No access configuration found for this clan');
  }
  return data.members.map((member) => member.sanitized);
}

export async function getAccessConfigSummary(clanTag: string) {
  const normalized = normalizeClanTag(clanTag);
  const data = isSupabaseAvailable()
    ? await fetchMembersSupabase(normalized)
    : fetchMembersMemory(normalized);
  if (!data) {
    return null;
  }
  return {
    clanTag: normalized,
    clanName: data.config.clanName,
    memberCount: data.members.filter((member) => member.sanitized.isActive).length,
    createdAt: data.config.createdAt,
  };
}

export async function authenticateAccessMember(clanTag: string, candidatePassword: string) {
  const normalized = normalizeClanTag(clanTag);
  const data = isSupabaseAvailable()
    ? await fetchMembersSupabase(normalized)
    : fetchMembersMemory(normalized);
  if (!data) return null;

  if (isSupabaseAvailable()) {
    for (const member of data.members) {
      const hash = member.raw.password_hash as string;
      if (member.raw.is_active && passwordsMatch(hash, candidatePassword)) {
        await getSupabaseAdminClient()
          .from('clan_access_members')
          .update({ last_accessed: new Date().toISOString() })
          .eq('id', member.raw.id);
        return member.sanitized;
      }
    }
  } else {
    const config = memoryStore.get(normalized);
    if (!config) return null;
    for (const member of config.members.values()) {
      if (member.isActive && passwordsMatch(member.passwordHash, candidatePassword)) {
        member.lastAccessed = new Date().toISOString();
        return toSanitizedMember(member);
      }
    }
  }
  return null;
}

export async function addAccessMember(params: AddMemberParams) {
  const normalized = normalizeClanTag(params.clanTag);
  const password = generateAccessPassword();
  const passwordHash = hashAccessPassword(password);

  if (isSupabaseAvailable()) {
    const supabase = getSupabaseAdminClient();
    const supaData = await fetchMembersSupabase(normalized);
    if (!supaData) {
      throw new Error('No access configuration found for this clan');
    }
    const { data: memberRow, error } = await supabase
      .from('clan_access_members')
      .insert({
        config_id: supaData.configId,
        clan_tag: normalized,
        name: params.name,
        player_tag: params.cocPlayerTag || null,
        email: params.email || null,
        access_level: params.accessLevel,
        password_hash: passwordHash,
        notes: params.notes || null,
        added_by: params.addedBy,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to add access member: ${error.message}`);
    }
    return {
      member: sanitizeDbMember(memberRow),
      password,
    };
  }

  const config = memoryStore.get(normalized);
  if (!config) {
    throw new Error('No access configuration found for this clan');
  }
  const now = new Date().toISOString();
  const member: MemoryAccessMember = {
    id: randomUUID(),
    name: params.name,
    accessLevel: params.accessLevel,
    passwordHash,
    cocPlayerTag: params.cocPlayerTag,
    email: params.email,
    notes: params.notes,
    addedBy: params.addedBy,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
  config.members.set(member.id, member);
  config.updatedAt = now;
  return {
    member: toSanitizedMember(member),
    password,
  };
}

export async function updateAccessMember(params: UpdateMemberParams) {
  const normalized = normalizeClanTag(params.clanTag);
  const allowedFields: Array<keyof AddMemberParams> = ['name', 'accessLevel', 'cocPlayerTag', 'email', 'notes'];
  const payload: Record<string, any> = {};
  for (const key of allowedFields) {
    if ((params.updates as any)[key] !== undefined) {
      switch (key) {
        case 'cocPlayerTag':
          payload.player_tag = params.updates[key];
          break;
        case 'accessLevel':
          payload.access_level = params.updates[key];
          break;
        case 'email':
          payload.email = params.updates[key];
          break;
        case 'notes':
          payload.notes = params.updates[key];
          break;
        case 'name':
          payload.name = params.updates[key];
          break;
      }
    }
  }

  if (isSupabaseAvailable()) {
    const supabase = getSupabaseAdminClient();
    if (Object.keys(payload).length === 0) {
      const { data, error } = await supabase
        .from('clan_access_members')
        .select('*')
        .eq('id', params.memberId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to load access member: ${error.message}`);
      }
      if (!data) {
        throw new Error('Member not found');
      }
      return sanitizeDbMember(data);
    }
    const { data, error } = await supabase
      .from('clan_access_members')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', params.memberId)
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to update access member: ${error.message}`);
    }
    return sanitizeDbMember(data);
  }

  const config = memoryStore.get(normalized);
  if (!config) {
    throw new Error('No access configuration found for this clan');
  }
  const member = config.members.get(params.memberId);
  if (!member) {
    throw new Error('Member not found');
  }
  if (payload.name) member.name = payload.name;
  if (payload.access_level) member.accessLevel = payload.access_level;
  if (payload.player_tag !== undefined) member.cocPlayerTag = payload.player_tag;
  if (payload.email !== undefined) member.email = payload.email;
  if (payload.notes !== undefined) member.notes = payload.notes;
  member.updatedAt = new Date().toISOString();
  return toSanitizedMember(member);
}

export async function deactivateAccessMember(clanTag: string, memberId: string) {
  const normalized = normalizeClanTag(clanTag);
  const now = new Date().toISOString();
  if (isSupabaseAvailable()) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('clan_access_members')
      .update({ is_active: false, updated_at: now })
      .eq('id', memberId);
    if (error) {
      throw new Error(`Failed to deactivate access member: ${error.message}`);
    }
    return;
  }
  const config = memoryStore.get(normalized);
  if (!config) {
    throw new Error('No access configuration found for this clan');
  }
  const member = config.members.get(memberId);
  if (member) {
    member.isActive = false;
  }
  config.updatedAt = now;
}

export function __resetMemoryAccessStore() {
  memoryStore.clear();
}
