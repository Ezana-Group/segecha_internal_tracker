import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  if (!id) return new NextResponse('Not Found', { status: 404 })

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
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const { data: cu } = await supabaseAdmin.from('client_users').select('client_id').eq('auth_user_id', user.id).eq('status', 'Active').maybeSingle()
  if (!cu) return new NextResponse('Forbidden', { status: 403 })

  const { data: inv } = await supabaseAdmin.from('invoices').select('*').eq('id', id).single()
  if (!inv || (inv.client_id ?? inv.clientId) !== cu.client_id) return new NextResponse('Not Found', { status: 404 })

  const [{ data: payments }, { data: journey }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('invoice_payments').select('*').eq('invoice_id', id),
    inv.journey ? supabaseAdmin.from('journeys').select('*').eq('id', inv.journey).single() : Promise.resolve({ data: null }),
    supabaseAdmin.from('settings').select('*').limit(1).maybeSingle(),
  ])
  const journeyRow = journey || null
  const { data: truck } = journeyRow?.truck ? await supabaseAdmin.from('trucks').select('reg').eq('id', journeyRow.truck).single() : { data: null }
  const { data: driver } = journeyRow?.driver ? await supabaseAdmin.from('drivers').select('name').eq('id', journeyRow.driver).single() : { data: null }

  const amount = Number(inv.amount ?? 0)
  const vat = Math.round(amount * 0.16)
  const subtotal = amount - vat
  const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const isFullyPaid = totalPaid >= amount
  const paybill = (settings as any)?.paybill_display || (settings as any)?.till_display || '—'
  const accountPrefix = String((settings as any)?.account_prefix ?? 'INV').trim()
  const accountNumber = accountPrefix && !String(inv.id || '').startsWith(accountPrefix) ? `${accountPrefix}-${inv.id}` : (inv.id ?? '')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(inv.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 720px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .invoice-title { font-size: 28px; font-weight: 900; color: #ea580c; }
    .company { font-weight: 800; font-size: 18px; text-align: right; }
    .meta { font-size: 12px; color: #666; }
    .billed { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .status.paid { background: #d1fae5; color: #065f46; }
    .status.overdue { background: #fee2e2; color: #991b1b; }
    .status.pending { background: #fef3c7; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f97316; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; }
    td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .total-row { background: #f97316; color: #fff; font-weight: 800; }
    .payments { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
    .mpesa { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
    .footer { font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">INVOICE</div>
      <div class="meta">${escapeHtml(inv.id ?? '—')}</div>
    </div>
    <div>
      <div class="company">Segecha Group Ltd</div>
      <div class="meta">Nairobi, Kenya</div>
      <div class="meta">Tel: +254 700 000 000</div>
    </div>
  </div>
  <div class="billed">
    <div>
      <div class="meta" style="text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Billed To</div>
      <div style="font-weight:700;font-size:15px">${escapeHtml(inv.client ?? '—')}</div>
      <div class="meta">📞 ${escapeHtml(inv.phone ?? '—')}</div>
    </div>
    <div style="text-align:right">
      <div class="meta">Date Issued: <b>${escapeHtml(inv.issued ?? '—')}</b></div>
      <div class="meta">Due Date: <b>${escapeHtml(inv.due ?? '—')}</b></div>
      <span class="status ${isFullyPaid ? 'paid' : (inv.status === 'Overdue' ? 'overdue' : 'pending')}">${isFullyPaid ? 'Paid' : (inv.status ?? 'Pending')}</span>
    </div>
  </div>
  ${journeyRow ? `
  <table>
    <thead><tr><th>Description</th><th>Route</th><th>Truck</th><th>Driver</th><th>Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>Freight — ${escapeHtml((journeyRow as any).cargo ?? '—')}</td>
        <td>${escapeHtml((journeyRow as any).origin ?? '—')} → ${escapeHtml((journeyRow as any).dest ?? '—')}</td>
        <td>${escapeHtml((truck as any)?.reg ?? '—')}</td>
        <td>${escapeHtml((driver as any)?.name ?? '—')}</td>
        <td style="font-weight:700">KES ${subtotal.toLocaleString()}</td>
      </tr>
      <tr style="background:#f9fafb"><td colspan="4" style="text-align:right;color:#666">VAT (16%)</td><td style="font-weight:600">KES ${vat.toLocaleString()}</td></tr>
      <tr class="total-row"><td colspan="4" style="text-align:right">TOTAL DUE</td><td>KES ${amount.toLocaleString()}</td></tr>
    </tbody>
  </table>
  ` : `<p><strong>Amount:</strong> KES ${amount.toLocaleString()}</p>`}
  ${(isFullyPaid || (payments && payments.length > 0)) ? `
  <div class="payments">
    <div style="font-weight:700;color:#065f46;font-size:13px">${isFullyPaid ? '✅ Payment complete' : '📋 Payments received'}</div>
    ${payments && payments.length > 0 ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:#047857">${payments.map((p: any) => `<li>KES ${Number(p.amount || 0).toLocaleString()} · ${p.paidDate || p.paid_date} ${p.mpesaRef ? `· ${p.mpesaRef}` : ''}</li>`).join('')}</ul>` : ''}
  </div>
  ` : ''}
  <div class="mpesa">
    <div class="meta" style="text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Pay via M-Pesa</div>
    <div style="font-size:14px;font-weight:700">Paybill: <code>${escapeHtml(paybill)}</code></div>
    <div style="font-size:14px;font-weight:700;margin-top:4px">Account: <code>${escapeHtml(accountNumber)}</code></div>
    <div class="meta" style="margin-top:4px">Amount: KES ${amount.toLocaleString()}</div>
  </div>
  <div class="footer">Payment via M-Pesa Paybill · Bank Transfer · Thank you for your business!</div>
  <p class="no-print" style="margin-top:20px"><button onclick="window.print()" style="padding:8px 16px;background:#f97316;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">🖨️ Print / Save as PDF</button></p>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
