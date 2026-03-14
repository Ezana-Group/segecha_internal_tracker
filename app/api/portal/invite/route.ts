import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: { maxAge?: number; path?: string } }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
    const role = (profile as any)?.role
    if (role !== 'admin' && role !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { client_id, email, name, company_name } = await req.json()
    if (!client_id || !email || !name) return NextResponse.json({ error: 'client_id, email and name are required' }, { status: 400 })

    const redirectUrl = `${baseUrl}/portal/reset-password`
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name, client_id, portal: true },
      redirectTo: redirectUrl,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const { error: insertError } = await supabaseAdmin.from('client_users').insert({
      client_id,
      email,
      name,
      auth_user_id: authData.user.id,
      status: 'Active',
    })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
