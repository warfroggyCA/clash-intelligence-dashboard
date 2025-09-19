import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { createAccessConfig, authenticateAccessMember, listAccessMembers } from '@/lib/server/access-service';

// This test requires environment variables to be set
describe('Supabase Connection Tests', () => {
  const testClanTag = '#TESTSUPABASE';
  const testClanName = 'Test Supabase Clan';

  beforeAll(() => {
    // Ensure we have the required environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this test');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for this test');
    }
  });

  it('can connect to Supabase admin client', () => {
    expect(() => getSupabaseAdminClient()).not.toThrow();
  });

  it('can create access config in Supabase', async () => {
    const result = await createAccessConfig({
      clanTag: testClanTag,
      clanName: testClanName,
      ownerName: 'Supabase Test Leader',
    });

    expect(result.config.clanTag).toBe(testClanTag);
    expect(result.config.clanName).toBe(testClanName);
    expect(result.ownerPassword).toHaveLength(8);
    expect(result.ownerMember.name).toBe('Supabase Test Leader');
    expect(result.ownerMember.accessLevel).toBe('leader');
  });

  it('can authenticate access member in Supabase', async () => {
    const { ownerPassword } = await createAccessConfig({
      clanTag: testClanTag + '2',
      clanName: testClanName + ' 2',
      ownerName: 'Supabase Test Leader 2',
    });

    const authenticated = await authenticateAccessMember(testClanTag + '2', ownerPassword);
    expect(authenticated).not.toBeNull();
    expect(authenticated?.name).toBe('Supabase Test Leader 2');
    expect(authenticated?.accessLevel).toBe('leader');
  });

  it('can list access members from Supabase', async () => {
    const { ownerPassword } = await createAccessConfig({
      clanTag: testClanTag + '3',
      clanName: testClanName + ' 3',
      ownerName: 'Supabase Test Leader 3',
    });

    const members = await listAccessMembers(testClanTag + '3');
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe('Supabase Test Leader 3');
    expect(members[0].accessLevel).toBe('leader');
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from('clan_access_members').delete().like('clan_tag', testClanTag + '%');
      await supabase.from('clan_access_configs').delete().like('clan_tag', testClanTag + '%');
    } catch (error) {
      console.warn('Failed to clean up test data:', error);
    }
  });
});
