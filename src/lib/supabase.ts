import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export const supabaseConfigError = !isValidSupabaseUrl(supabaseUrl)
  ? 'Supabase URL mungon ose nuk është i vlefshëm. Kontrollo VITE_SUPABASE_URL në .env.'
  : !supabaseAnonKey || supabaseAnonKey === '******'
    ? 'Supabase anon key mungon ose nuk është i vlefshëm. Kontrollo VITE_SUPABASE_ANON_KEY në .env.'
    : ''

export const supabase = createClient(
  isValidSupabaseUrl(supabaseUrl) ? supabaseUrl! : 'https://invalid.supabase.local',
  supabaseAnonKey && supabaseAnonKey !== '******' ? supabaseAnonKey : 'missing-anon-key',
)

export async function getProfileRole(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.role
}

export function supabaseNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('failed to fetch') || message.includes('network') || message.includes('fetch')
    ? 'Nuk mund të lidhemi me Supabase. Kontrollo internetin dhe VITE_SUPABASE_URL në .env.'
    : error instanceof Error ? error.message : 'Kërkesa për Supabase dështoi. Provo përsëri.'
}
