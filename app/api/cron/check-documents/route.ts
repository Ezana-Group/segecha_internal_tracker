import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS, SMS_TEMPLATES } from '@/lib/sms'
import { DOC_LABELS } from '@/lib/documents'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings: Record<string, string> = {}
  ;(settingsRows || []).forEach((r: { key: string; value: string }) => {
    settings[r.key] = r.value ?? ''
  })
  const adminPhones = (settings.notification_admin_phone || '')
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const directorPhones = (settings.notification_director_phone || '')
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const phones = [...new Set([...adminPhones, ...directorPhones])]
  if (phones.length === 0) {
    return NextResponse.json({ expiring: 0, expired: 0, message: 'No notification phones configured' })
  }

  const { data: docExpiringSetting } = await supabase
    .from('notification_settings')
    .select('enabled')
    .eq('key', 'document_expiring')
    .single()
  const { data: docExpiredSetting } = await supabase
    .from('notification_settings')
    .select('enabled')
    .eq('key', 'document_expired')
    .single()
  const sendExpiring = docExpiringSetting?.enabled !== false
  const sendExpired = docExpiredSetting?.enabled !== false

  const today = new Date().toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const { data: expiring } = await supabase
    .from('documents')
    .select('*')
    .in('expiry_date', [in30Days, in7Days])

  const { data: expired } = await supabase
    .from('documents')
    .select('*')
    .lte('expiry_date', today)

  const toNotify: { doc: any; trigger: 'document_expiring' | 'document_expired'; daysLeft: number }[] = []
  ;(expiring || []).forEach((doc: any) => {
    if (!sendExpiring) return
    const daysLeft = Math.ceil(
      (new Date(doc.expiry_date).getTime() - Date.now()) / 86400000
    )
    toNotify.push({ doc, trigger: 'document_expiring', daysLeft })
  })
  ;(expired || []).forEach((doc: any) => {
    if (!sendExpired) return
    const daysLeft = Math.ceil(
      (new Date(doc.expiry_date).getTime() - Date.now()) / 86400000
    )
    toNotify.push({ doc, trigger: 'document_expired', daysLeft })
  })

  const docTypeLabel = (doc: any) => DOC_LABELS[doc.doc_type] || doc.doc_type
  const entityName = (doc: any) => doc.entity_name || doc.entity_id || '—'

  for (const { doc, trigger, daysLeft } of toNotify) {
    const message =
      trigger === 'document_expired'
        ? SMS_TEMPLATES.document_expired(docTypeLabel(doc), entityName(doc))
        : SMS_TEMPLATES.document_expiring(docTypeLabel(doc), entityName(doc), daysLeft)

    for (const phone of phones) {
      await sendSMS(
        phone,
        message,
        trigger,
        doc.id,
        undefined
      )
    }
  }

  return NextResponse.json({
    expiring: expiring?.length ?? 0,
    expired: expired?.length ?? 0,
    notified: toNotify.length,
  })
}
