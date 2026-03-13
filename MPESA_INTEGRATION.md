# M-Pesa (Daraja) Integration Plan

This document outlines how M-Pesa is integrated into the Segecha ERP: STK Push for invoice payments, configurable Paybill/Till, transaction list with verify/match/refund, and paying drivers.

---

## 1. Overview

| Feature | Description |
|--------|--------------|
| **STK Push (invoices)** | Send a payment request to customer's phone; they enter PIN to pay. |
| **Paybill / Till (editable)** | Show Paybill (or Buy Goods) number and account number on invoices; configurable in **Settings**. |
| **Transactions** | List all payments received via M-Pesa; verify and match to invoice or payroll. |
| **Refund** | Reverse a transaction (Daraja Reversal API). |
| **Pay drivers** | Send salary to driver's M-Pesa via B2C (Business to Customer). |

---

## 2. Safaricom Daraja API (Kenya)

- **Portal:** [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- **Sandbox:** Use sandbox credentials for testing; switch to production when going live.
- **Required credentials** (store in `.env.local`, never in DB):
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE` (Paybill or Till number)
  - `MPESA_PASSKEY` (Lipa Na M-Pesa passkey from portal)
  - `MPESA_INITIATOR_NAME` (for B2C)
  - `MPESA_INITIATOR_SECURITY_CREDENTIAL` (encrypted password for B2C)

**Callback URL** must be **public HTTPS**. In production use your Vercel URL, e.g.  
`https://your-app.vercel.app/api/mpesa/callback`.  
For local testing use **ngrok** and put the ngrok HTTPS URL in Daraja portal and in env as `MPESA_CALLBACK_BASE_URL`.

---

## 3. App Behaviour

### 3.1 Settings (admin)

- **Path:** `/admin/settings` (or under existing admin section).
- **Editable (stored in DB):**
  - **Paybill number** – Shown on invoices and used for STK Push (can override Shortcode for display).
  - **Till / Buy Goods number** – Optional; if you use Till instead of Paybill.
  - **Account number format** – Optional; e.g. "INV" so manual payers see "Account: INV-12345".
- **Not editable in UI** (security): Consumer Key, Consumer Secret, Passkey, Initiator credentials. These stay in environment variables.

### 3.2 Invoices

- **Display:** Invoice view and PDF show **Paybill (or Till) number** and **Account number** (invoice ID or formatted). Customer can pay manually via M-Pesa → Paybill → Account → Amount.
- **STK Push:** "Request payment" button:
  - Calls backend with `invoiceId`.
  - Backend reads invoice (amount, client phone), gets shortcode from env/settings.
  - Calls Daraja **Lipa Na M-Pesa Online** (STK Push). Customer gets prompt on phone.
  - When they pay, Safaricom sends result to our **callback URL**; we save to `mpesa_transactions` and can auto-match to invoice by `AccountReference` (invoice id).

### 3.3 M-Pesa transactions

- **Source:** Every payment (STK Push result, and optionally B2C result) is sent by Safaricom to our callback; we store it in `mpesa_transactions`.
- **Transactions page:** List all such transactions with:
  - Date, phone, amount, M-Pesa receipt number, account reference, status.
  - **Verify:** Confirm money received (we already got it via callback; "Verify" = confirm and optionally match).
  - **Match to invoice:** Link transaction to an invoice → set invoice status to Paid, store `mpesaRef` and `paidDate`.
  - **Match to payroll:** Link to a payroll record → mark as Paid, store `mpesaRef` and `paidDate`.
  - **Refund:** Call Daraja **Reversal** API; then mark transaction as reversed and optionally update linked invoice/payroll.

### 3.4 Pay drivers (B2C)

- From **Payroll**, "Send via M-Pesa" can call Daraja **B2C** API to send money to the driver's M-Pesa number.
- On success (or when we get B2C result callback), we update payroll: status Paid, `mpesaRef`, `paidDate`.
- B2C requires Initiator name and Security Credential in env.

---

## 4. Database

- **`settings`** table (key-value): e.g. `paybill_display`, `till_display`, `account_prefix`. Used for display and for choosing which shortcode to use if you have both Paybill and Till.
- **`mpesa_transactions`** table: `id`, `transaction_id` (Safaricom), `receipt_number`, `phone`, `amount`, `transaction_date`, `account_reference`, `result_code`, `result_description`, `invoice_id` (nullable), `payroll_id` (nullable), `status` (completed/failed/reversed), `raw_payload` (jsonb), `created_at`.

---

## 5. API Routes (Next.js)

| Route | Method | Purpose |
|-------|--------|--------|
| `/api/mpesa/callback` | POST | Daraja sends STK Push (and optionally B2C) results here. Save to `mpesa_transactions`; optionally auto-match to invoice by `account_reference`. |
| `/api/mpesa/stk-push` | POST | Body: `{ invoiceId }`. Initiates STK Push for that invoice. |
| `/api/mpesa/b2c` | POST | Body: `{ payrollId }` or `{ amount, phone, reference }`. Sends money to driver. |
| `/api/mpesa/reversal` | POST | Body: `{ transactionId }` (our DB id or Safaricom TransactionID). Reverses payment. |
| `/api/mpesa/transactions` | GET | Optional: list transactions (or frontend reads from Supabase directly). |

---

## 6. Security

- Callback URL: Validate that the request comes from Safaricom (e.g. IP allowlist or shared secret if available). Return 200 quickly and process async.
- Never expose Consumer Key/Secret, Passkey, or Initiator credentials to the client. Use server-side API routes only.
- Store only non-sensitive display values in `settings` (Paybill/Till numbers for display).

---

## 7. Env variables (add to `.env.local` and Vercel)

```env
# M-Pesa Daraja (get from https://developer.safaricom.co.ke)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=          # Paybill or Till number (used for API)
MPESA_PASSKEY=            # Lipa Na M-Pesa passkey
# Callback base URL (production: https://your-app.vercel.app)
MPESA_CALLBACK_BASE_URL=https://your-app.vercel.app

# B2C (pay drivers)
MPESA_INITIATOR_NAME=
MPESA_INITIATOR_SECURITY_CREDENTIAL=
MPESA_B2C_SHORTCODE=      # Usually same as MPESA_SHORTCODE
```

---

## 8. Implementation order

1. Schema: `settings`, `mpesa_transactions`.
2. Settings page: edit Paybill/Till (and optional account prefix).
3. Callback API: receive Daraja callback, save to `mpesa_transactions`.
4. STK Push API: initiate from invoice; callback stores result.
5. Transactions page: list, match to invoice/payroll, refund.
6. Invoice UI: show Paybill + account; "Request payment (STK Push)" button.
7. B2C API + Payroll "Send via M-Pesa" that actually sends money.
8. Reversal API + Refund button on transactions.
