import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side admin instance (never expose to client)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type UserRole = 'admin' | 'director' | 'viewer'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
}
