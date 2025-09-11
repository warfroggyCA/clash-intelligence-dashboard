import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { snapshots, tenureLedger } = await request.json();
    
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
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Snapshots uploaded successfully to Supabase',
      uploaded: {
        snapshots: uploadedSnapshots.length,
        hasTenureLedger: tenureUploaded,
        files: uploadedSnapshots
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}

