/**
 * SMS service — Africa's Talking. Server-side only; do not import in client code.
 */

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export function formatKEPhone(phone: string): string {
  const clean = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
  if (clean.startsWith('+254')) return clean
  if (clean.startsWith('254')) return '+' + clean
  if (clean.startsWith('07') || clean.startsWith('01')) {
    return '+254' + clean.slice(1)
  }
  return clean
}

export async function sendSMS(
  phone: string,
  message: string,
  referenceType?: string,
  referenceId?: string,
  recipientName?: string
): Promise<SMSResult> {
  const formattedPhone = formatKEPhone(phone)
  const username = process.env.AT_USERNAME || 'sandbox'
  const apiKey = process.env.AT_API_KEY
  const from = process.env.AT_SENDER_ID || 'SEGECHA'

  if (!apiKey) {
    console.error('SMS: AT_API_KEY not set')
    return { success: false, error: 'SMS not configured' }
  }

  const baseUrl =
    username === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

  try {
    const params = new URLSearchParams({
      username,
      to: formattedPhone,
      message,
      from,
    })

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey,
      },
      body: params.toString(),
    })

    const data = await response.json().catch(() => ({}))
    const recipient = data?.SMSMessageData?.Recipients?.[0]

    if (recipient?.status === 'Success') {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.from('notifications').insert({
        recipient: formattedPhone,
        recipient_name: recipientName ?? null,
        message,
        trigger_type: referenceType ?? 'manual',
        reference_id: referenceId ?? null,
        status: 'sent',
        at_message_id: recipient.messageId ?? null,
        sent_at: new Date().toISOString(),
      })
      return { success: true, messageId: recipient.messageId }
    }

    const errMsg = recipient?.status || data?.SMSMessageData?.Message || `HTTP ${response.status}`
    throw new Error(errMsg)
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error)
    console.error('SMS send failed:', errMessage)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.from('notifications').insert({
        recipient: formattedPhone,
        recipient_name: recipientName ?? null,
        message,
        trigger_type: referenceType ?? 'manual',
        reference_id: referenceId ?? null,
        status: 'failed',
        error_message: errMessage,
      })
    } catch (logErr) {
      console.error('Failed to log SMS failure:', logErr)
    }
    return { success: false, error: errMessage }
  }
}

export const SMS_TEMPLATES = {
  invoice_due: (clientName: string, invoiceId: string, amount: string, dueDate: string) =>
    `Dear ${clientName}, invoice ${invoiceId} for KES ${amount} is due on ${dueDate}. Please arrange payment. Contact: Segecha Group.`,

  invoice_overdue: (clientName: string, invoiceId: string, amount: string, daysOverdue: number) =>
    `Dear ${clientName}, invoice ${invoiceId} for KES ${amount} is ${daysOverdue} day(s) overdue. Please pay immediately to avoid service interruption. Segecha Group.`,

  invoice_paid: (clientName: string, invoiceId: string, amount: string) =>
    `Dear ${clientName}, payment of KES ${amount} for invoice ${invoiceId} has been received. Thank you. Segecha Group.`,

  document_expiring: (docType: string, entityName: string, daysLeft: number) =>
    `ALERT: ${docType} for ${entityName} expires in ${daysLeft} day(s). Please renew immediately. Segecha Group ERP.`,

  document_expired: (docType: string, entityName: string) =>
    `URGENT: ${docType} for ${entityName} has EXPIRED. Vehicle/driver cannot operate. Renew now. Segecha Group.`,

  journey_started: (driverName: string, route: string, truckReg: string) =>
    `Trip started: ${driverName} departed on ${route} in truck ${truckReg}. Segecha Group ERP.`,

  journey_completed: (driverName: string, route: string) =>
    `Trip completed: ${driverName} has arrived. Route: ${route}. Segecha Group ERP.`,

  payroll_paid: (driverName: string, amount: string, month: string, mpesaRef: string) =>
    `Dear ${driverName}, your salary of KES ${amount} for ${month} has been sent via M-Pesa. Ref: ${mpesaRef}. Segecha Group.`,

  driver_submission: (driverName: string, type: string) =>
    `New submission from ${driverName}: ${type} is pending your review in the ERP. Segecha Group.`,
}
