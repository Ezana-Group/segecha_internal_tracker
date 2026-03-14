import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Ensures the current user has a row in public.users (creates with role admin if missing).
 * Uses cookies when available; falls back to access_token + refresh_token in body (so it works when Route Handler doesn't receive cookies).
 */
export async function POST(req: NextRequest) {
  try {
    let user: { id: string; email?: string; user_metadata?: { name?: string } } | null = null

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : undefined
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : undefined

    if (accessToken && refreshToken) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      )
      const { data: { user: u }, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (!error && u) user = u
    }

    if (!user) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet: { name: string; value: string; options?: { maxAge?: number; path?: string } }[]) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch {
                // ignore
              }
            },
          },
        }
      )
      const { data: { user: u }, error } = await supabase.auth.getUser()
      if (!error && u) user = u
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Sign in again and retry.' },
        { status: 401 }
      )
    }

    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    const { error: upsertError } = await supabaseAdmin.from('users').upsert(
      {
        id: user.id,
        email: user.email ?? '',
        name,
        role: 'admin',
      },
      { onConflict: 'id' }
    )
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
