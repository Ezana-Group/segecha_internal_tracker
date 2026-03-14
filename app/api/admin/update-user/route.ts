import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId, email, name } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const updates: { email?: string; user_metadata?: { name?: string } } = {}
    if (email !== undefined) updates.email = email
    if (name !== undefined) updates.user_metadata = { name }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
