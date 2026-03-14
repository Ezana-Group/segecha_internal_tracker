import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Ensures the current user has a row in public.users (creates with role admin if missing).
 * Use when you're logged in but "Could not load profile" — e.g. RLS blocks client-side upsert.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll() {},
        },
      }
    )
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
