import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Stored summary functions
export async function saveAISummary(summary: Omit<AISummary, 'id' | 'created_at'>) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  
  const { data, error } = await supabase
    .from('ai_summaries')
    .insert([summary])
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to save insights summary: ${error.message}`)
  }
  
  return data
}

export async function getAISummaries(clanTag: string) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  
  const { data, error } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('clan_tag', clanTag)
    .order('created_at', { ascending: false })
  
  if (error) {
    throw new Error(`Failed to fetch insights summaries: ${error.message}`)
  }
  
  return data || []
}

export async function markAISummaryAsRead(id: number) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  
  const { error } = await supabase
    .from('ai_summaries')
    .update({ unread: false })
    .eq('id', id)
  
  if (error) {
    throw new Error(`Failed to mark summary as read: ${error.message}`)
  }
}

export async function markAISummaryAsActioned(id: number) {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  
  const { error } = await supabase
    .from('ai_summaries')
    .update({ actioned: true, unread: false })
    .eq('id', id)
  
  if (error) {
    throw new Error(`Failed to mark summary as actioned: ${error.message}`)
  }
}

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

export interface AISummary {
  id?: number
  clan_tag: string
  date: string
  summary: string
  summary_type: string
  unread: boolean
  actioned: boolean
  created_at?: string
}
