import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Admin-only: send a password reset email to a user. They reset it themselves via the link.
 * Auth: cookies first; fallback to access_token + refresh_token in body (so it works when cookies aren't sent).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const userId = typeof body?.userId === 'string' ? body.userId : null
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    let user: { id: string } | null = null
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : undefined
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : undefined

    if (accessToken && refreshToken) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      )
      const { data: { user: u }, error } = await client.auth.setSession({
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
      const { data: { user: u }, error: authError } = await supabase.auth.getUser()
      if (authError || !u) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = u
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()
    if (!targetUser?.email) {
      return NextResponse.json(
        { error: 'User not found or has no email' },
        { status: 400 }
      )
    }

    const origin = req.nextUrl.origin
    const redirectTo = `${origin}/account`

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: sendError } = await anonClient.auth.resetPasswordForEmail(
      targetUser.email,
      { redirectTo }
    )
    if (sendError) {
      return NextResponse.json(
        { error: sendError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${targetUser.email}`,
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
