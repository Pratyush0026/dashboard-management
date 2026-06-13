import { createClient } from '@supabase/supabase-js'

let supabaseAdmin: any = null

export function getSupabaseAdmin(): any {
  if (supabaseAdmin) return supabaseAdmin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  supabaseAdmin = createClient<any>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseAdmin
}

export function getSupabaseClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  return createClient<any>(url, key)
}
