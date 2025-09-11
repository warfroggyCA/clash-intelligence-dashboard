import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database types
export interface Snapshot {
  id?: number
  clan_tag: string
  filename: string
  date: string
  member_count: number
  clan_name: string
  timestamp: string
  file_url: string
  created_at?: string
}

export interface TenureLedger {
  id?: number
  file_url: string
  size: number
  created_at?: string
}
