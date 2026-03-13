'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const KEYS = {
  paybill_display: 'Paybill number (e.g. 123456)',
  till_display: 'Till / Buy Goods number (optional)',
  account_prefix: 'Account number prefix (e.g. INV — shown as "Account: INV-12345")',
} as const

export default function AdminSettingsPage() {
  const { S } = useErpContext()
  const [values, setValues] = useState<Record<string, string>>({
    paybill_display: '',
    till_display: '',
    account_prefix: 'INV',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('settings').select('key, value')
    const map: Record<string, string> = { paybill_display: '', till_display: '', account_prefix: 'INV' }
    ;(data || []).forEach((r: any) => { map[r.key] = r.value ?? '' })
    setValues(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(values)) {
        await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
      }
      toast.success('Settings saved')
    } catch (e) {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AppLayout><div style={S.ph}>Loading settings...</div></AppLayout>

  return (
    <AppLayout>
      <div style={{ maxWidth: 560 }}>
        <div style={{ ...S.mtitle, marginBottom: 8 }}>⚙️ Settings</div>
        <p style={{ fontSize: 13, color: S.kpi?.color || '#64748b', marginBottom: 24 }}>
          M-Pesa Paybill / Till numbers shown on invoices. API credentials (Consumer Key, Passkey, etc.) are set in environment variables — see <code style={{ fontSize: 11 }}>MPESA_INTEGRATION.md</code>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(Object.keys(KEYS) as (keyof typeof KEYS)[]).map(key => (
            <div key={key} style={S.fg}>
              <label style={S.lbl}>{KEYS[key]}</label>
              <input
                style={S.inp}
                value={values[key] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={key === 'account_prefix' ? 'INV' : ''}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button style={S.btn()} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
        </div>
        <div style={{ marginTop: 32, padding: 16, background: S.wrap?.background || '#f8fafc', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12, color: S.kpi?.color }}>
          <strong>On invoices:</strong> Customers will see Paybill (or Till) and Account number so they can pay manually. Use &quot;Request payment&quot; in the app to send an STK Push to the customer&apos;s phone.
        </div>
      </div>
    </AppLayout>
  )
}
