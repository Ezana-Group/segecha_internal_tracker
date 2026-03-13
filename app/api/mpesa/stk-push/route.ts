import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stkPush } from '@/lib/mpesa-daraja'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: inv, error: invErr } = await supabase.from('invoices').select('id, amount, phone, client, status').eq('id', invoiceId).single()
    if (invErr || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (inv.status === 'Paid') return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 })
    const phone = (inv.phone || '').trim().replace(/\D/g, '')
    if (phone.length < 9) return NextResponse.json({ error: 'Invoice has no valid client phone number' }, { status: 400 })

    const base = process.env.MPESA_CALLBACK_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app'
    const callbackUrl = `${base.replace(/\/$/, '')}/api/mpesa/callback`

    const result = await stkPush({
      amount: Number(inv.amount) || 0,
      phone: phone.replace(/^0/, '254'),
      accountReference: inv.id,
      transactionDesc: `Invoice ${inv.id}`,
      callbackUrl,
    })

    if (result.errorCode) {
      return NextResponse.json({ error: result.errorMessage || result.errorCode }, { status: 400 })
    }
    return NextResponse.json({ success: true, checkoutRequestId: result.CheckoutRequestID })
  } catch (e: any) {
    console.error('STK Push error:', e)
    return NextResponse.json({ error: e.message || 'STK Push failed' }, { status: 500 })
  }
}
