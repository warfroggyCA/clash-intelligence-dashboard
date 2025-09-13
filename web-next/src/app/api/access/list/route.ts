import { NextRequest, NextResponse } from 'next/server';
import { ClanAccessConfig, AccessMember } from '../../../../lib/access-management';

// In production, this would use Supabase or another database
// For now, we'll use a simple in-memory store (you'd want to persist this)
let accessConfigs: Map<string, ClanAccessConfig> = new Map();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clanTag = searchParams.get('clanTag');
    const accessPassword = searchParams.get('accessPassword');

    if (!clanTag || !accessPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Clan tag and access password required' 
      }, { status: 400 });
    }

    const config = accessConfigs.get(clanTag.toUpperCase());
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'No access configuration found for this clan' 
      }, { status: 404 });
    }

    // Find the access member with this password
    const accessMember = config.accessMembers.find(member => 
      member.password === accessPassword && member.isActive
    );

    if (!accessMember) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid access password' 
      }, { status: 401 });
    }

    // Update last accessed time
    accessMember.lastAccessed = new Date().toISOString();
    accessConfigs.set(clanTag.toUpperCase(), config);

    // Return the access member info (without sensitive data)
    const { password, ...memberInfo } = accessMember;
    
    return NextResponse.json({
      success: true,
      accessMember: memberInfo,
      permissions: config.accessMembers.find(m => m.id === accessMember.id)
    });

  } catch (error) {
    console.error('Error fetching access list:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clanTag, accessPassword, action } = body;

    if (!clanTag || !accessPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Clan tag and access password required' 
      }, { status: 400 });
    }

    const config = accessConfigs.get(clanTag.toUpperCase());
    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'No access configuration found for this clan' 
      }, { status: 404 });
    }

    // Verify the access password belongs to someone who can manage access
    const manager = config.accessMembers.find(member => 
      member.password === accessPassword && member.isActive
    );

    if (!manager) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid access password' 
      }, { status: 401 });
    }

    if (!manager.accessLevel || !['leader', 'coleader'].includes(manager.accessLevel)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions to manage access' 
      }, { status: 403 });
    }

    // Handle different actions
    switch (action) {
      case 'list':
        // Return all access members (for management interface)
        const membersList = config.accessMembers.map(({ password, ...member }) => member);
        return NextResponse.json({
          success: true,
          accessMembers: membersList,
          clanInfo: {
            clanTag: config.clanTag,
            clanName: config.clanName
          }
        });

      case 'add':
        const { name, cocPlayerTag, email, accessLevel, notes } = body;
        if (!name || !accessLevel) {
          return NextResponse.json({ 
            success: false, 
            error: 'Name and access level required' 
          }, { status: 400 });
        }

        // Generate new access password
        const newPassword = generateAccessPassword();
        const newMember: AccessMember = {
          id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          cocPlayerTag,
          email,
          accessLevel,
          password: newPassword,
          createdAt: new Date().toISOString(),
          isActive: true,
          addedBy: manager.name,
          notes
        };

        config.accessMembers.push(newMember);
        config.updatedAt = new Date().toISOString();
        accessConfigs.set(clanTag.toUpperCase(), config);

        return NextResponse.json({
          success: true,
          accessMember: {
            ...newMember,
            password: newPassword // Return password to share with the new member
          }
        });

      case 'update':
        const { memberId, updates } = body;
        const memberIndex = config.accessMembers.findIndex(m => m.id === memberId);
        
        if (memberIndex === -1) {
          return NextResponse.json({ 
            success: false, 
            error: 'Member not found' 
          }, { status: 404 });
        }

        // Update member
        config.accessMembers[memberIndex] = {
          ...config.accessMembers[memberIndex],
          ...updates,
          password: config.accessMembers[memberIndex].password // Don't allow password changes via update
        };
        config.updatedAt = new Date().toISOString();
        accessConfigs.set(clanTag.toUpperCase(), config);

        return NextResponse.json({
          success: true,
          accessMember: config.accessMembers[memberIndex]
        });

      case 'remove':
        const { memberIdToRemove } = body;
        const memberToRemoveIndex = config.accessMembers.findIndex(m => m.id === memberIdToRemove);
        
        if (memberToRemoveIndex === -1) {
          return NextResponse.json({ 
            success: false, 
            error: 'Member not found' 
          }, { status: 404 });
        }

        // Deactivate member instead of removing (for audit trail)
        config.accessMembers[memberToRemoveIndex].isActive = false;
        config.updatedAt = new Date().toISOString();
        accessConfigs.set(clanTag.toUpperCase(), config);

        return NextResponse.json({
          success: true,
          message: 'Member access revoked successfully'
        });

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid action' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing access:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Helper function to generate access password
function generateAccessPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
