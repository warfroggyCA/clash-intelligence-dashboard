import {
  __resetMemoryAccessStore,
  createAccessConfig,
  authenticateAccessMember,
  listAccessMembers,
  addAccessMember,
  deactivateAccessMember,
} from '@/lib/server/access-service';

beforeEach(() => {
  __resetMemoryAccessStore();
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
});

describe('Access service (memory fallback)', () => {
  const clanTag = '#TESTCLAN';
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
