import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  if (!id) return new NextResponse('Not Found', { status: 404 })

  const { data: j } = await supabaseAdmin.from('journeys').select('*').eq('id', id).single()
  if (!j) return new NextResponse('Not Found', { status: 404 })

  const { data: truck } = j.truck ? await supabaseAdmin.from('trucks').select('reg').eq('id', j.truck).single() : { data: null }
  const { data: driver } = j.driver ? await supabaseAdmin.from('drivers').select('name').eq('id', j.driver).single() : { data: null }

  const waybillNum = j.waybill_number || j.id
  const dateStr = j.date ? new Date(j.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Waybill ${escapeHtml(waybillNum)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; max-width: 800px; margin: 0 auto; }
    .letterhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 3px solid #f97316; }
    .logo { width: 56px; height: 56px; border-radius: 50%; background: #f97316; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }
    .company { font-weight: 800; font-size: 20px; color: #ea580c; }
    .waybill-title { font-size: 24px; font-weight: 900; color: #1e293b; margin-bottom: 4px; }
    .waybill-num { font-size: 14px; color: #64748b; }
    .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .box-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px; }
    .box-value { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
    th { background: #f97316; color: #fff; font-size: 12px; }
    .sign-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; }
    .sign-cell { border-bottom: 1px solid #1e293b; padding-bottom: 4px; text-align: center; font-size: 11px; color: #64748b; }
    .terms { font-size: 10px; color: #64748b; margin-top: 24px; line-height: 1.5; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="letterhead">
    <div>
      <div class="logo">SG</div>
      <div class="company" style="margin-top:8px">Segecha Group Ltd</div>
      <div style="font-size:12px;color:#64748b">Nairobi, Kenya · Tel: +254 700 000 000</div>
    </div>
    <div style="text-align:right">
      <div class="waybill-title">WAYBILL</div>
      <div class="waybill-num">${escapeHtml(waybillNum)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">Date: ${escapeHtml(dateStr)}</div>
    </div>
  </div>

  <div class="boxes">
    <div class="box">
      <div class="box-label">Shipper</div>
      <div class="box-value">${escapeHtml(j.shipper || '—')}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${escapeHtml(j.shipper_address || '')}</div>
    </div>
    <div class="box">
      <div class="box-label">Consignee</div>
      <div class="box-value">${escapeHtml(j.consignee || '—')}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${escapeHtml(j.consignee_address || '')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Packages</th><th>Weight (t)</th><th>Declared Value (KES)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(j.cargo_description || j.cargo || '—')}</td>
        <td>${escapeHtml(j.packages_count != null ? String(j.packages_count) : '—')}</td>
        <td>${escapeHtml(j.weight != null ? String(j.weight) : '—')}</td>
        <td>${escapeHtml(j.cargo_value != null ? Number(j.cargo_value).toLocaleString() : '—')}</td>
      </tr>
    </tbody>
  </table>
  ${(j.special_instructions || '').trim() ? `<p><strong>Special instructions:</strong> ${escapeHtml(j.special_instructions)}</p>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
    <div><span style="font-size:11px;color:#64748b">Driver</span><div style="font-weight:600">${escapeHtml((driver as any)?.name ?? '—')}</div></div>
    <div><span style="font-size:11px;color:#64748b">Truck</span><div style="font-weight:600">${escapeHtml((truck as any)?.reg ?? '—')}</div></div>
  </div>
  <div style="margin-top:8px;font-size:12px;color:#64748b">Route: ${escapeHtml((j.origin || '—') + ' → ' + (j.dest || '—'))}</div>

  <div class="sign-row">
    <div class="sign-cell">Driver signature</div>
    <div class="sign-cell">Shipper signature</div>
    <div class="sign-cell">Consignee signature</div>
  </div>

  <div class="terms">
    <strong>Terms:</strong> Cargo carried subject to standard conditions. Declared value for insurance purposes only unless otherwise agreed. Segecha Group Ltd shall not be liable for loss or damage beyond declared value. Receiver to sign on delivery.
  </div>

  <p class="no-print" style="margin-top:24px"><button onclick="window.print()" style="padding:10px 20px;background:#f97316;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">Print / Save as PDF</button></p>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
