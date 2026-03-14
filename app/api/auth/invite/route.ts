import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, name, role, staff_type: staffType } = await req.json()
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, name and role are required' }, { status: 400 })
    }
    if (role === 'staff' && !staffType) {
      return NextResponse.json({ error: 'Staff type is required when inviting staff (e.g. driver, marketing, office)' }, { status: 400 })
    }

    // Invite user via Supabase Auth (sends magic link email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name, role, staff_type: staffType || null },
      redirectTo: `${process.env.NEXTAUTH_URL}/dashboard`,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // Create profile row
    await supabaseAdmin.from('users').upsert({
      id: authData.user.id,
      email,
      name,
      role,
      staff_type: role === 'staff' ? staffType : null,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
