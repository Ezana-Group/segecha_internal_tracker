/**
 * Client-side helper: fire-and-forget SMS via API. Do not await in main flow.
 * Message builders here to avoid importing server-only lib/sms in client.
 */

export const NOTIFY_MESSAGES = {
  invoice_paid: (clientName: string, invoiceId: string, amount: string) =>
    `Dear ${clientName}, payment of KES ${amount} for invoice ${invoiceId} has been received. Thank you. Segecha Group.`,
  journey_started: (driverName: string, route: string, truckReg: string) =>
    `Trip started: ${driverName} departed on ${route} in truck ${truckReg}. Segecha Group ERP.`,
  journey_completed: (driverName: string, route: string) =>
    `Trip completed: ${driverName} has arrived. Route: ${route}. Segecha Group ERP.`,
  payroll_paid: (driverName: string, amount: string, month: string, mpesaRef: string) =>
    `Dear ${driverName}, your salary of KES ${amount} for ${month} has been sent via M-Pesa. Ref: ${mpesaRef}. Segecha Group.`,
  driver_submission: (driverName: string, type: string) =>
    `New submission from ${driverName}: ${type} is pending your review in the ERP. Segecha Group.`,
}

export async function notify(
  phone: string,
  message: string,
  triggerType?: string,
  referenceId?: string,
  recipientName?: string
) {
  fetch('/api/notify/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message, triggerType, referenceId, recipientName }),
  }).catch(console.error)
}

/** Send to director phone(s) from settings. No await. */
export async function notifyDirector(
  message: string,
  triggerType?: string,
  referenceId?: string
) {
  fetch('/api/notify/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sendToRole: 'director', triggerType, referenceId }),
  }).catch(console.error)
}

/** Send to admin phone(s) from settings. No await. */
export async function notifyAdmin(
  message: string,
  triggerType?: string,
  referenceId?: string
) {
  fetch('/api/notify/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sendToRole: 'admin', triggerType, referenceId }),
  }).catch(console.error)
}
