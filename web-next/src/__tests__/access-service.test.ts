import {
  __resetMemoryAccessStore,
  createAccessConfig,
  authenticateAccessMember,
  listAccessMembers,
  addAccessMember,
  deactivateAccessMember,
} from '@/lib/server/access-service';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  __resetMemoryAccessStore();
  // Only clear Supabase credentials if we're testing memory fallback
  if (process.env.NODE_ENV === 'test' && process.env.TEST_MEMORY_FALLBACK === 'true') {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  }
});

afterEach(async () => {
  // Clean up test data from Supabase
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('clan_access_members').delete().like('clan_tag', '#TESTCLAN%');
    await supabase.from('clan_access_configs').delete().like('clan_tag', '#TESTCLAN%');
  } catch (error) {
    console.warn('Failed to clean up test data:', error);
  }
});

describe('Access service (Supabase)', () => {
  const clanTag = '#TESTCLAN' + Date.now();
  const clanName = 'Test Clan';

  it('creates config and authenticates owner', async () => {
    const result = await createAccessConfig({
      clanTag,
      clanName,
      ownerName: 'Leader',
    });
    expect(result.ownerPassword).toHaveLength(8);

    const owner = await authenticateAccessMember(clanTag, result.ownerPassword);
    expect(owner).not.toBeNull();
    expect(owner?.accessLevel).toBe('leader');
  });

  it('adds and lists members', async () => {
    const { ownerPassword } = await createAccessConfig({
      clanTag,
      clanName,
      ownerName: 'Leader',
    });

    const owner = await authenticateAccessMember(clanTag, ownerPassword);
    expect(owner).not.toBeNull();

    const { member, password } = await addAccessMember({
      clanTag,
      name: 'Co-Leader',
      accessLevel: 'coleader',
      addedBy: owner!.name,
    });
    expect(member.name).toBe('Co-Leader');
    expect(password).toHaveLength(8);

    const members = await listAccessMembers(clanTag);
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.name === 'Co-Leader')).toBeTruthy();
    expect(members.every((m) => !('password' in m))).toBe(true);

    await deactivateAccessMember(clanTag, member.id);
    const updatedMembers = await listAccessMembers(clanTag);
    const deactivated = updatedMembers.find((m) => m.id === member.id);
    expect(deactivated?.isActive).toBe(false);
  });
});
