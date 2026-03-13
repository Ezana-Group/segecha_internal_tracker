import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function parseStkCallback(body: any): { resultCode: number; resultDesc: string; receiptNumber?: string; amount?: number; phone?: string; transactionDate?: string; checkoutRequestId?: string } {
  const stk = body?.Body?.stkCallback || body?.stkCallback
  if (!stk) return { resultCode: -1, resultDesc: 'Invalid callback body' }
  const meta = stk.CallbackMetadata?.Item || []
  const get = (name: string) => meta.find((i: any) => i.Name === name)?.Value
  return {
    resultCode: Number(stk.ResultCode) ?? -1,
    resultDesc: stk.ResultDesc || '',
    receiptNumber: String(get('MpesaReceiptNumber') || ''),
    amount: Number(get('Amount') || 0),
    phone: String(get('PhoneNumber') || ''),
    transactionDate: String(get('TransactionDate') || ''),
    checkoutRequestId: stk.CheckoutRequestID || body?.Body?.stkCallback?.CheckoutRequestID,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseStkCallback(body)
    const hasMeta = !!(body?.Body?.stkCallback?.CallbackMetadata || body?.Body?.stkCallback?.ResultCode !== undefined)
    if (!hasMeta) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 })
    }

    const id = `MP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const status = parsed.resultCode === 0 ? 'completed' : 'failed'
    const { error } = await supabase.from('mpesa_transactions').insert({
      id,
      transactionId: parsed.receiptNumber ? `Safaricom-${parsed.receiptNumber}-${Date.now()}` : null,
      receiptNumber: parsed.receiptNumber || null,
      phone: parsed.phone || null,
      amount: parsed.amount || 0,
      transactionDate: parsed.transactionDate || null,
      accountReference: null,
      resultCode: parsed.resultCode,
      resultDescription: parsed.resultDesc,
      status,
      rawPayload: body,
    })
    if (error) console.error('M-Pesa callback insert error:', error)

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 })
  } catch (e) {
    console.error('M-Pesa callback error:', e)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' }, { status: 200 })
  }
}
