/** Road freight waybill — print in a new window (A4, Arial, no app chrome). */

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem("segecha_settings") || "{}");
    } catch {
        return {};
    }
}

function escapeHtml(str) {
    if (str == null || str === "") return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fmtLine(v) {
    const s = escapeHtml(v);
    return s || "&nbsp;";
}

function fmtKes(v) {
    if (v == null || v === "") return "&nbsp;";
    const n = Number(v);
    if (!Number.isFinite(n)) return fmtLine(v);
    return "KES " + n.toLocaleString("en-KE");
}

function safeLogoSrc(url) {
    if (!url || typeof url !== "string") return "";
    const t = url.trim();
    if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:image/")) return t;
    return "";
}

/**
 * @param {object} f — waybillData snapshot (same shape as WaybillModal form)
 */
export function openWaybillPrintWindow(f) {
    const s = getSettings();
    const logoRaw = localStorage.getItem("segecha_logo") || s.companyLogo || "";
    const logoUrl = safeLogoSrc(logoRaw);
    const companyName = s.companyName || "Segecha Group Ltd";

    const totalGrossKg = f.cargo.reduce((acc, c) => acc + (+c.grossKg || 0), 0);
    const totalNetKg = f.cargo.reduce((acc, c) => acc + (+c.netKg || 0), 0);
    const totalPackages = f.cargo.reduce((acc, c) => acc + (+c.packages || 0), 0);
    const totalValue = f.cargo.reduce((acc, c) => acc + (+c.declaredValue || 0), 0);

    const checkedDocs = [
        f.docs.commercialInvoice && "Commercial invoice",
        f.docs.packingList && "Packing list",
        f.docs.kraCustomsEntry && "KRA customs entry / IDF",
        f.docs.certOfOrigin && "Certificate of origin",
        f.docs.comesaLicence && "COMESA carrier licence",
        f.docs.transitBond && "Goods in transit bond",
        f.docs.phytoSanitary && "Phytosanitary certificate",
        f.docs.kebsCertificate && "KEBS certificate",
        f.docs.t1Document && "T1 transit document",
        f.docs.dangerousGoodsDecl && "Dangerous goods declaration",
        f.docs.insuranceCert && "Insurance certificate",
        typeof f.docs.other === "string" && f.docs.other.trim() && f.docs.other.trim(),
    ].filter(Boolean);

    const blankRows = Math.max(0, 4 - f.cargo.length);

    const issued = f.generatedAt
        ? new Date(f.generatedAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
        : "";

    const logoBlock = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" style="height:48px;max-width:100px;object-fit:contain;" alt="">`
        : `<span>${escapeHtml(companyName.charAt(0))}</span>`;

    const cargoRows = f.cargo
        .map(
            (c, i) => `<tr>
          <td>${i + 1}</td>
          <td>${fmtLine(c.description)}</td>
          ${f.isCrossBorder ? `<td style="font-family:monospace">${fmtLine(c.hsCode)}</td>` : ""}
          <td>${fmtLine(c.packages)}</td>
          <td style="font-family:monospace">${fmtLine(c.grossKg)}</td>
          <td style="font-family:monospace">${fmtLine(c.netKg)}</td>
          <td>${fmtLine(c.volumeM3)}</td>
          <td style="font-family:monospace">${fmtLine(c.declaredValue)}</td>
        </tr>`
        )
        .join("");

    const blankRowHtml = `<tr>
          <td>&nbsp;</td><td></td>
          ${f.isCrossBorder ? "<td></td>" : ""}
          <td></td><td></td><td></td><td></td><td></td>
        </tr>`;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${escapeHtml(f.waybillNo)} — Road Freight Waybill</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt;
       color: #000; background: #fff; }
.outer { border: 1.5px solid #000; width: 100%; }
.hdr { display: flex; align-items: flex-start; gap: 12px;
       padding: 8px 12px; border-bottom: 1.5px solid #000; }
.logo { width: 52px; height: 52px; border: 1px solid #ccc;
        display: flex; align-items: center; justify-content: center;
        font-size: 18pt; font-weight: 700; flex-shrink: 0; }
.hdr-mid { flex: 1; }
.hdr-title { font-size: 18pt; font-weight: 700;
             text-transform: uppercase; letter-spacing: 1px; }
.hdr-sub { font-size: 7.5pt; color: #444; margin-top: 2px; }
.hdr-legal { font-size: 7pt; color: #555; margin-top: 4px; }
.wb-num-box { text-align: right; }
.wb-num-label { font-size: 7pt; color: #777;
                text-transform: uppercase; letter-spacing: 0.5px; }
.wb-num-val { font-size: 14pt; font-weight: 700; font-family: monospace;
              border: 1px solid #000; padding: 2px 7px;
              display: inline-block; margin-top: 2px; }
.wb-issued { font-size: 8pt; color: #555; margin-top: 4px; }
.notice { background: #f0f0f0; padding: 3px 10px; font-size: 8pt;
          border-bottom: 1px solid #bbb; }
.sec { border-bottom: 1px solid #000; }
.sec-title { font-size: 8pt; font-weight: 700;
             text-transform: uppercase; letter-spacing: 0.6px;
             padding: 3px 8px; background: #e8e8e8;
             border-bottom: 1px solid #bbb; }
.fields { display: grid; }
.field { padding: 4px 7px; border-right: 0.5px solid #ccc;
         border-bottom: 0.5px solid #eee; }
.field:last-child { border-right: none; }
.fl { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.4px;
      color: #555; margin-bottom: 2px; }
.fv { font-size: 9.5pt; border-bottom: 0.5px solid #999;
      min-height: 16px; padding-bottom: 1px; }
.fv.lg { font-size: 11pt; font-weight: 700; }
.fv.mono { font-family: monospace; }
table.cargo { width: 100%; border-collapse: collapse; }
table.cargo th { font-size: 7.5pt; text-transform: uppercase;
                 letter-spacing: 0.4px; padding: 3px 5px;
                 border-bottom: 1px solid #000; border-right: 0.5px solid #bbb;
                 background: #e8e8e8; text-align: left; }
table.cargo td { font-size: 9pt; padding: 3px 5px;
                 border-bottom: 0.5px solid #ddd;
                 border-right: 0.5px solid #ccc; min-height: 16px; }
table.cargo tr.totrow td { border-top: 1px solid #000;
                            font-weight: 700; background: #e8e8e8; }
.twocol { display: grid; grid-template-columns: 1fr 1fr; }
.twocol > div:first-child { border-right: 1px solid #000; }
.sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
.sig-box { padding: 7px 9px; border-right: 0.5px solid #bbb; }
.sig-box:last-child { border-right: none; }
.sig-note { font-size: 8pt; color: #333; margin-bottom: 3px; }
.sig-line { border-bottom: 1px solid #000; margin: 22px 0 3px; }
.sig-lbl { font-size: 7pt; color: #666; text-transform: uppercase; }
.stamp { width: 64px; height: 64px; border: 1px dashed #aaa; float: right;
         margin: 3px 0 3px 8px; display: flex; align-items: center;
         justify-content: center; font-size: 7pt; color: #aaa; text-align: center; }
.copy-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 3px 10px;
            background: #f8f8f8; border-top: 1px solid #bbb; font-size: 7.5pt; }
.copy-dot { width: 7px; height: 7px; border-radius: 50%;
            display: inline-block; margin-right: 3px; }
</style>
</head>
<body>
<div class="outer">

  <div class="hdr">
    <div class="logo">${logoBlock}</div>
    <div class="hdr-mid">
      <div class="hdr-title">Road Freight Waybill</div>
      <div class="hdr-sub">
        Consignment Note / Goods Received Note &nbsp;·&nbsp;
        ${f.isCrossBorder ? "CROSS-BORDER" : "DOMESTIC"}
      </div>
      <div class="hdr-legal">
        Traffic Act Cap. 403 (Kenya) &nbsp;·&nbsp;
        EAC Customs Management Act 2004 &nbsp;·&nbsp;
        COMESA Transit Trade Regulations
      </div>
    </div>
    <div class="wb-num-box">
      <div class="wb-num-label">Waybill no.</div>
      <div class="wb-num-val">${fmtLine(f.waybillNo)}</div>
      <div class="wb-issued">Issued: ${escapeHtml(issued)}</div>
    </div>
  </div>

  <div class="notice">
    Carrier: <strong>${f.carrierName ? escapeHtml(f.carrierName) : "_______________"}</strong>
    &nbsp;·&nbsp; KRA PIN: <strong>${f.carrierKraPin ? fmtLine(f.carrierKraPin) : "_______________"}</strong>
    ${
        f.isCrossBorder
            ? " &nbsp;·&nbsp; CROSS-BORDER — 4 COPIES REQUIRED — KRA PIN MANDATORY"
            : " &nbsp;·&nbsp; DOMESTIC — 4 COPIES REQUIRED"
    }
  </div>

  <div class="sec">
    <div class="sec-title">1 · Carrier (transporter)</div>
    <div class="fields" style="grid-template-columns:2fr 1fr 1fr">
      <div class="field"><div class="fl">Company name</div>
        <div class="fv lg">${fmtLine(f.carrierName)}</div></div>
      <div class="field"><div class="fl">KRA PIN</div>
        <div class="fv mono">${fmtLine(f.carrierKraPin)}</div></div>
      <div class="field"><div class="fl">NTSA licence</div>
        <div class="fv mono">${fmtLine(f.carrierNtsa)}</div></div>
      <div class="field"><div class="fl">Address</div>
        <div class="fv">${fmtLine(f.carrierAddress)}</div></div>
      <div class="field"><div class="fl">Phone</div>
        <div class="fv mono">${fmtLine(f.carrierPhone)}</div></div>
      <div class="field"><div class="fl">Email</div>
        <div class="fv">${fmtLine(f.carrierEmail)}</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">2 · Vehicle &amp; driver</div>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr 1fr">
      <div class="field"><div class="fl">Vehicle reg.</div>
        <div class="fv lg mono">${fmtLine(f.vehicleReg)}</div></div>
      <div class="field"><div class="fl">Trailer reg.</div>
        <div class="fv mono">${fmtLine(f.trailerReg)}</div></div>
      <div class="field"><div class="fl">Type</div>
        <div class="fv">${fmtLine(f.vehicleType)}</div></div>
      <div class="field"><div class="fl">Max payload (kg)</div>
        <div class="fv mono">${fmtLine(f.maxPayload)}</div></div>
      <div class="field"><div class="fl">Driver name</div>
        <div class="fv lg">${fmtLine(f.driverName)}</div></div>
      <div class="field"><div class="fl">ID / Passport</div>
        <div class="fv mono">${fmtLine(f.driverIdNo)}</div></div>
      <div class="field"><div class="fl">PSV / DL licence</div>
        <div class="fv mono">${fmtLine(f.driverLicence)}</div></div>
      <div class="field"><div class="fl">Driver phone</div>
        <div class="fv mono">${fmtLine(f.driverPhone)}</div></div>
    </div>
  </div>

  <div class="sec twocol">
    <div>
      <div class="sec-title">3 · Consignor (sender)</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Full name / company</div>
          <div class="fv lg">${fmtLine(f.consignorName)}</div></div>
        <div class="field"><div class="fl">KRA PIN</div>
          <div class="fv mono">${fmtLine(f.consignorKraPin)}</div></div>
        <div class="field"><div class="fl">Phone</div>
          <div class="fv mono">${fmtLine(f.consignorPhone)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Loading address</div>
          <div class="fv">${fmtLine(f.consignorAddress)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Date &amp; time of loading</div>
          <div class="fv mono">${fmtLine(f.loadingDateTime)}</div></div>
      </div>
    </div>
    <div>
      <div class="sec-title">4 · Consignee (receiver)</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Full name / company</div>
          <div class="fv lg">${fmtLine(f.consigneeName)}</div></div>
        <div class="field">
          <div class="fl">KRA PIN${f.isCrossBorder ? " ✱" : ""}</div>
          <div class="fv mono">${fmtLine(f.consigneeKraPin)}</div></div>
        <div class="field"><div class="fl">Phone</div>
          <div class="fv mono">${fmtLine(f.consigneePhone)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Delivery address</div>
          <div class="fv">${fmtLine(f.consigneeAddress)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Expected delivery date</div>
          <div class="fv mono">${fmtLine(f.expectedDelivery)}</div></div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">5 · Route</div>
    <div class="fields" style="grid-template-columns:1fr 1fr ${f.isCrossBorder ? "1fr " : ""}1fr">
      <div class="field"><div class="fl">Origin</div>
        <div class="fv lg">${fmtLine(f.origin)}</div></div>
      <div class="field"><div class="fl">Destination</div>
        <div class="fv lg">${fmtLine(f.destination)}</div></div>
      ${
          f.isCrossBorder
              ? `<div class="field"><div class="fl">Border crossing</div>
           <div class="fv">${fmtLine(f.borderPoint)}</div></div>`
              : ""
      }
      <div class="field"><div class="fl">Est. distance (km)</div>
        <div class="fv mono">${fmtLine(String(f.estDistance))}</div></div>
    </div>
    ${
        f.isCrossBorder
            ? `<div class="fields" style="grid-template-columns:2fr 1fr 1fr">
           <div class="field"><div class="fl">Approved transit route</div>
             <div class="fv">${fmtLine(f.transitRoute)}</div></div>
           <div class="field"><div class="fl">Odom at loading (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtLoading)}</div></div>
           <div class="field"><div class="fl">Odom at delivery (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtDelivery)}</div></div>
         </div>`
            : `<div class="fields" style="grid-template-columns:1fr 1fr">
           <div class="field"><div class="fl">Odom at loading (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtLoading)}</div></div>
           <div class="field"><div class="fl">Odom at delivery (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtDelivery)}</div></div>
         </div>`
    }
  </div>

  <div class="sec">
    <div class="sec-title">6 · Cargo description</div>
    <table class="cargo">
      <thead>
        <tr>
          <th style="width:20px">#</th>
          <th>Description of goods</th>
          ${f.isCrossBorder ? '<th style="width:65px">HS code</th>' : ""}
          <th style="width:52px">Packages</th>
          <th style="width:62px">Gross kg</th>
          <th style="width:62px">Net kg</th>
          <th style="width:52px">Vol m³</th>
          <th style="width:80px">Declared value</th>
        </tr>
      </thead>
      <tbody>
        ${cargoRows}
        ${Array(blankRows).fill(blankRowHtml).join("")}
        <tr class="totrow">
          <td colspan="${f.isCrossBorder ? 3 : 2}"
              style="text-align:right;font-size:7.5pt;
                     text-transform:uppercase;letter-spacing:0.4px">
            Totals
          </td>
          <td>${totalPackages ? escapeHtml(String(totalPackages)) : ""}</td>
          <td style="font-family:monospace">
            ${totalGrossKg ? escapeHtml(totalGrossKg.toLocaleString("en-KE")) : ""}</td>
          <td style="font-family:monospace">
            ${totalNetKg ? escapeHtml(totalNetKg.toLocaleString("en-KE")) : ""}</td>
          <td></td>
          <td style="font-family:monospace">
            ${totalValue ? "KES " + escapeHtml(totalValue.toLocaleString("en-KE")) : ""}</td>
        </tr>
      </tbody>
    </table>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr">
      <div class="field"><div class="fl">Nature of goods</div>
        <div class="fv">${fmtLine(f.cargoNature)}</div></div>
      <div class="field"><div class="fl">Special handling</div>
        <div class="fv">${fmtLine(f.specialHandling)}</div></div>
      <div class="field"><div class="fl">Seal / container no.</div>
        <div class="fv mono">${fmtLine(f.sealNo)}</div></div>
      <div class="field" style="grid-column:1/-1;border-right:none">
        <div class="fl">Exceptions at loading (NIL if none)</div>
        <div class="fv">${fmtLine(f.exceptionsAtLoading)}</div></div>
    </div>
  </div>

  <div class="sec twocol">
    <div>
      <div class="sec-title">7 · Freight charges</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field"><div class="fl">Agreed freight</div>
          <div class="fv mono lg">${fmtKes(f.agreedFreight)}</div></div>
        <div class="field"><div class="fl">Payment terms</div>
          <div class="fv">${fmtLine(f.paymentTerms)}</div></div>
        <div class="field"><div class="fl">Advance paid</div>
          <div class="fv mono">${fmtKes(f.advancePaid)}</div></div>
        <div class="field"><div class="fl">Balance due</div>
          <div class="fv mono">${fmtKes(f.balanceDue)}</div></div>
      </div>
    </div>
    <div>
      <div class="sec-title">8 · Documents accompanying</div>
      <div style="padding:5px 8px;display:grid;
                  grid-template-columns:1fr 1fr;gap:1px;font-size:8pt">
        ${
            checkedDocs.length > 0
                ? checkedDocs.map((d) => `<div>&#9745; ${escapeHtml(d)}</div>`).join("")
                : '<div style="color:#999">None specified</div>'
        }
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">
      9 · Certification at loading — all parties sign before truck departs
    </div>
    <div class="sig-row">
      <div class="sig-box">
        <div class="stamp">Company stamp</div>
        <div class="sig-note">
          Consignor — I confirm the goods above have been handed to the
          carrier in the stated condition.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">
          Driver — I have received the goods and confirm the details above
          are correct.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="stamp">Carrier stamp</div>
        <div class="sig-note">
          Carrier authorised rep. — required for cross-border.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">10 · Delivery receipt — completed by consignee on delivery</div>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr">
      <div class="field"><div class="fl">Date &amp; time of delivery</div>
        <div class="fv mono">${fmtLine(f.deliveryDateTime)}</div></div>
      <div class="field"><div class="fl">Final odometer (km)</div>
        <div class="fv mono">${fmtLine(f.odomAtDeliveryFinal)}</div></div>
      <div class="field"><div class="fl">Condition on arrival</div>
        <div class="fv">${fmtLine(f.conditionOnArrival)}</div></div>
      <div class="field" style="grid-column:1/-1;border-right:none">
        <div class="fl">Exceptions / damage (NIL if none)</div>
        <div class="fv" style="min-height:20px">
          ${fmtLine(f.exceptionsOnDelivery)}</div></div>
    </div>
    <div class="sig-row">
      <div class="sig-box">
        <div class="stamp">Company stamp</div>
        <div class="sig-note">
          Consignee — I confirm receipt of the goods described above.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · ID no. · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">Driver — delivery completed.</div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">Balance freight received:</div>
        <div style="font-size:14pt;font-weight:700;font-family:monospace;
                    margin:6px 0 14px">
          ${
              f.balanceReceived
                  ? "KES " + escapeHtml(Number(f.balanceReceived).toLocaleString("en-KE"))
                  : "_______________"
          }
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Carrier receipt stamp · Date</div>
      </div>
    </div>
  </div>

  <div class="copy-bar">
    <strong>4 copies:</strong>
    <span>
      <span class="copy-dot" style="background:#1a7f37"></span>
      White — Consignor (original, retained)
    </span>
    <span>
      <span class="copy-dot" style="background:#0969da"></span>
      Blue — Consignee (travels with goods, surrendered on delivery)
    </span>
    <span>
      <span class="copy-dot" style="background:#d1242f"></span>
      Red — Driver (kept throughout journey)
    </span>
    <span>
      <span class="copy-dot" style="background:#9a6700"></span>
      Yellow — KRA / Customs (surrendered at border or weighbridge)
    </span>
  </div>
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=900,height=900,toolbar=0,menubar=0,scrollbars=1");
    if (!win) {
        window.alert("Pop-up blocked. Please allow pop-ups for this site, then try Save & Print again.");
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
    }, 400);
}
