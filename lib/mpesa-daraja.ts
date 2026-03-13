/**
 * Safaricom Daraja API helpers (server-side only).
 * Use from API routes; do not expose credentials to client.
 */

const SANDBOX = 'https://sandbox.safaricom.co.ke'
const PROD = 'https://api.safaricom.co.ke'

function baseUrl() {
  return process.env.MPESA_ENV === 'production' ? PROD : SANDBOX
}

export async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY
  const secret = process.env.MPESA_CONSUMER_SECRET
  if (!key || !secret) throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required')
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Daraja OAuth failed: ${res.status} ${t}`)
  }
  const json = await res.json()
  if (!json.access_token) throw new Error('No access_token in Daraja response')
  return json.access_token
}

/** Lipa Na M-Pesa Online (STK Push). Phone: 2547XXXXXXXX */
export async function stkPush(params: {
  amount: number
  phone: string
  accountReference: string
  transactionDesc: string
  callbackUrl: string
}): Promise<{ CheckoutRequestID?: string; errorCode?: string; errorMessage?: string }> {
  const shortcode = process.env.MPESA_SHORTCODE
  const passkey = process.env.MPESA_PASSKEY
  if (!shortcode || !passkey) throw new Error('MPESA_SHORTCODE and MPESA_PASSKEY are required')

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

  const phone = params.phone.replace(/\D/g, '').replace(/^0/, '254')
  if (phone.length < 12) throw new Error('Invalid phone number')

  const token = await getAccessToken()
  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: params.callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: (params.transactionDesc || 'Payment').slice(0, 13),
  }

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.CheckoutRequestID) return { CheckoutRequestID: json.CheckoutRequestID }
  return { errorCode: json.errorCode || String(res.status), errorMessage: json.errorMessage || json.ErrorMessage || await res.text() }
}
