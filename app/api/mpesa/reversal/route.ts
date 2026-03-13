import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * M-Pesa Reversal (Refund). Requires Daraja Reversal API to be implemented
 * with MPESA_INITIATOR_NAME and MPESA_INITIATOR_SECURITY_CREDENTIAL.
 * For now we only mark the transaction as reversed in DB and optionally
 * unlink invoice/payroll so you can match again after a real reversal.
 */
export async function POST(req: NextRequest) {
  try {
    const { transactionId: txId } = await req.json()
    if (!txId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: txn } = await supabase.from('mpesa_transactions').select('*').eq('id', txId).single()
    if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    if (txn.status === 'reversed') return NextResponse.json({ error: 'Already reversed' }, { status: 400 })

    // TODO: Call Daraja Reversal API here when credentials are set:
    // POST .../mpesa/reversal/v1/request with TransactionID (Safaricom's), Amount, ReceiverParty, RecieverIdentifierType, ResultURL, QueueTimeOutURL, Remarks, Occasion
    // For now we only update our DB so the UI shows "reversed"
    const { error } = await supabase.from('mpesa_transactions').update({ status: 'reversed', invoiceId: null, payrollId: null }).eq('id', txId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Transaction marked as reversed. Configure Daraja Reversal API for actual refund.' })
  } catch (e: any) {
    console.error('Reversal error:', e)
    return NextResponse.json({ error: e.message || 'Reversal failed' }, { status: 500 })
  }
}
