import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS } from '@/lib/sms'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      phone,
      message,
      sendToRole,
      triggerType,
      referenceId,
      recipientName,
    } = body as {
      phone?: string
      message?: string
      sendToRole?: 'director' | 'admin'
      triggerType?: string
      referenceId?: string
      recipientName?: string
    }

    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (triggerType) {
      const { data: setting } = await supabase
        .from('notification_settings')
        .select('enabled')
        .eq('key', triggerType)
        .single()
      if (setting && setting.enabled === false) {
        return NextResponse.json({ success: true, skipped: true, reason: 'trigger disabled' })
      }
    }

    let phones: string[] = []

    if (sendToRole === 'director' || sendToRole === 'admin') {
      const key = sendToRole === 'director' ? 'notification_director_phone' : 'notification_admin_phone'
      const { data: row } = await supabase.from('settings').select('value').eq('key', key).single()
      const value = (row as { value?: string } | null)?.value?.trim() || ''
      phones = value ? value.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean) : []
      if (phones.length === 0) {
        return NextResponse.json({ success: true, skipped: true, reason: 'no phone configured' })
      }
    } else if (phone) {
      phones = [phone]
    } else {
      return NextResponse.json({ error: 'phone or sendToRole required' }, { status: 400 })
    }

    const results = await Promise.all(
      phones.map((p) => sendSMS(p, message, triggerType, referenceId, recipientName))
    )
    const allOk = results.every((r) => r.success)
    const firstError = results.find((r) => !r.success)?.error
    return NextResponse.json(
      allOk ? { success: true } : { success: false, error: firstError }
    )
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: err }, { status: 500 })
  }
}
