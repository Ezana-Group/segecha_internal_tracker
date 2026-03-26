export function openWaybillWindow(j, truckReg) {
    const f = j.waybillData;
    if (f && typeof f === 'object') {
        const w = window.open('', '_blank');
        const esc = (s) => String(s ?? '—').replace(/</g, '&lt;');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Waybill</title>
        <style>body{font-family:system-ui,sans-serif;padding:16px;max-width:720px;margin:0 auto;font-size:15px;line-height:1.5;color:#111}h1{font-size:1.1rem;margin:0 0 12px}.r{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #e5e7eb}footer{margin-top:20px;font-size:12px;color:#64748b}.btn{margin-top:16px;padding:12px 20px;background:#1B3A6B;color:#fff;border:none;border-radius:10px;font-weight:700;width:100%}</style></head><body>
        <h1>Road waybill</h1>
        <div class="r"><span>Waybill no.</span><b>${esc(f.waybillNo)}</b></div>
        <div class="r"><span>Vehicle</span><b>${esc(f.vehicleReg || truckReg)}</b></div>
        <div class="r"><span>Trailer</span><b>${esc(f.trailerReg)}</b></div>
        <div class="r"><span>Route</span><b>${esc(j.origin)} → ${esc(j.dest)}</b></div>
        <div class="r"><span>Carrier</span><b>${esc(f.carrierName)}</b></div>
        <div class="r"><span>Driver</span><b>${esc(f.driverName)}</b></div>
        <footer>Generated from driver portal · use browser menu to print or save as PDF.</footer>
        <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        </body></html>`);
        w.document.close();
        return;
    }
    if (j.waybillNo) {
        window.alert(`Waybill ${j.waybillNo} — ask the office to open the full waybill in the main tracker if you need all copies.`);
    } else {
        window.alert('No waybill yet. The office generates the waybill from the main tracker for this trip.');
    }
}
