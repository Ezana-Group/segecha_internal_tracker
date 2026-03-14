import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId, action } = await req.json()
    if (!userId || !action) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    if (action === 'revoke') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876600h', // 100 years = effectively permanent
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (action === 'restore') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
