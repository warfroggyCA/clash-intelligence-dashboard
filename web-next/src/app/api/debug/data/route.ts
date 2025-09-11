import { NextRequest, NextResponse } from 'next/server';
import { promises as fsp } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dataRoot = '/tmp/data';
    const snapshotsDir = path.join(dataRoot, 'snapshots');
    
    const result: any = {
      dataRoot,
      snapshotsDir,
      exists: {
        dataRoot: false,
        snapshotsDir: false
      },
      files: {
        dataRoot: [],
        snapshotsDir: []
      }
    };
    
    // Check if directories exist
    try {
      const stats = await fsp.stat(dataRoot);
      result.exists.dataRoot = stats.isDirectory();
    } catch (e) {
      result.exists.dataRoot = false;
    }
    
    try {
      const stats = await fsp.stat(snapshotsDir);
      result.exists.snapshotsDir = stats.isDirectory();
    } catch (e) {
      result.exists.snapshotsDir = false;
    }
    
    // List files if directories exist
    if (result.exists.dataRoot) {
      try {
        result.files.dataRoot = await fsp.readdir(dataRoot);
      } catch (e) {
        result.files.dataRoot = [];
      }
    }
    
    if (result.exists.snapshotsDir) {
      try {
        result.files.snapshotsDir = await fsp.readdir(snapshotsDir);
      } catch (e) {
        result.files.snapshotsDir = [];
      }
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
