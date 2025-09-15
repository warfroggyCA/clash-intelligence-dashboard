import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ApiResponse } from '@/types';
import { z } from 'zod';
import { rateLimitAllow, formatRateLimitHeaders } from '@/lib/inbound-rate-limit';
import { createApiContext } from '@/lib/api/route-helpers';

export async function POST(request: NextRequest) {
  const { json } = createApiContext(request, '/api/upload-snapshots');
  try {
    const body = await request.json();
    const Schema = z.object({
      snapshots: z.record(z.any()).optional(),
      tenureLedger: z.string().optional(),
    });
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    const { snapshots, tenureLedger } = parsed.data as any;

    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await rateLimitAllow(`upload-snapshots:${ip}`, { windowMs: 60_000, max: 6 });
    if (!limit.ok) {
      return json({ success: false, error: 'Too many requests' }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...formatRateLimitHeaders({ remaining: limit.remaining, resetAt: limit.resetAt }, 6),
        }
      });
    }
    
    const uploadedSnapshots = [];
    
    // Upload snapshots to Supabase Storage and Database
    if (snapshots) {
      for (const [filename, data] of Object.entries(snapshots)) {
        // Upload file to Supabase Storage
        const { data: fileData, error: fileError } = await supabase.storage
          .from('snapshots')
          .upload(filename, JSON.stringify(data, null, 2), {
            contentType: 'application/json'
          });
        
        if (fileError) {
          console.error('File upload error:', fileError);
          continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('snapshots')
          .getPublicUrl(filename);
        
        // Extract metadata from snapshot data
        const snapshotData = data as any;
        const clanTag = filename.split('_')[0] || 'unknown';
        
        // Insert metadata into database
        const { error: dbError } = await supabase
          .from('snapshots')
          .insert({
            clan_tag: clanTag,
            filename: filename,
            date: snapshotData.date || new Date().toISOString().split('T')[0],
            member_count: snapshotData.memberCount || snapshotData.members?.length || 0,
            clan_name: snapshotData.clanName || 'Unknown Clan',
            timestamp: snapshotData.timestamp || new Date().toISOString(),
            file_url: urlData.publicUrl
          });
        
        if (dbError) {
          console.error('Database insert error:', dbError);
        } else {
          uploadedSnapshots.push(filename);
        }
      }
    }
    
    // Upload tenure ledger to Supabase Storage and Database
    let tenureUploaded = false;
    if (tenureLedger) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from('tenure')
        .upload('tenure_ledger.jsonl', tenureLedger, {
          contentType: 'application/jsonl'
        });
      
      if (!fileError) {
        const { data: urlData } = supabase.storage
          .from('tenure')
          .getPublicUrl('tenure_ledger.jsonl');
        
        const { error: dbError } = await supabase
          .from('tenure_ledger')
          .upsert({
            file_url: urlData.publicUrl,
            size: tenureLedger.length
          });
        
        if (!dbError) {
          tenureUploaded = true;
        }
      }
    }
    
    return json({ success: true, data: { message: 'Snapshots uploaded successfully to Supabase', uploaded: { snapshots: uploadedSnapshots.length, hasTenureLedger: tenureUploaded, files: uploadedSnapshots } } });
    
  } catch (error) {
    console.error('Upload error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
