import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL;
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const STEPS = {
    SELECT: 'select',
    MPESA_STK: 'mpesa_stk',
    MPESA_MANUAL: 'mpesa_manual',
    BANK: 'bank',
    PESAPAL: 'pesapal',
    PESALINK: 'pesalink',
    CASH: 'cash',
    SUCCESS: 'success',
};

export default function PaymentPortal() {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('inv') || 'INV-UNKNOWN';
    const amount = +params.get('amount') || 0;
    const client = params.get('client') || 'Valued Client';

    const [step, setStep] = useState(STEPS.SELECT);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stkPending, setStkPending] = useState(false);
    const [settings, setSettings] = useState({ companyName: 'Segecha Group Ltd' });

    useEffect(() => {
        if (!API) {
            console.error("[PAYMENT_PORTAL] VITE_API_URL is not defined in environment.");
            return;
        }
        fetch(`${API}/api/public-settings`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                console.log("[PAYMENT_PORTAL] Public settings loaded:", data);
                setSettings(data);
            })
            .catch(err => {
                console.error("[PAYMENT_PORTAL] Failed to fetch settings:", err.message);
            });
    }, []);

    const { 
        companyName, 
        mpesaDisplayName,
        mpesaMode = 'paybill',
        paybillNumber, 
        tillNumber,
        mpesaAccountNoTemplate = 'Invoice No',
        bankName, 
        bankAccountName,
        bankAccountNumber, 
        bankBranch, 
        pesalinkBank, 
        pesalinkAccount, 
        currency = 'KES' 
    } = settings;

    const triggerSTK = async () => {
        if (!/^(0|254|\+254)7\d{8}$/.test(phone.replace(/\s/g, ''))) {
            setError('Enter a valid Kenyan M-Pesa number — e.g. 0712 345 678');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/api/mpesa/stk-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone.replace(/\s/g, ''), amount, invoiceId, clientName: client }),
            });
            const data = await res.json();
            if (data.success) setStkPending(true);
            else setError(data.error || 'Payment prompt failed — please try again');
        } catch {
            setError('Could not reach payment server. Please try another payment method.');
        }
        setLoading(false);
    };

    const goBack = () => { setStep(STEPS.SELECT); setStkPending(false); setError(''); };

    const S = {
        page: { minHeight: '100vh', background: 'radial-gradient(at 0% 0%, rgba(232, 80, 26, 0.1) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(27, 58, 107, 0.1) 0, transparent 50%), #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
        card: { background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 40, width: '100%', maxWidth: 480, boxShadow: '0 20px 50px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' },
        logo: { textAlign: 'center', marginBottom: 28 },
        logoIcon: { fontSize: 38, marginBottom: 8 },
        logoName: { fontSize: 22, fontWeight: 800, color: '#1B3A6B', letterSpacing: -0.5 },
        logoSub: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
        invBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', marginBottom: 28 },
        invRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#374151', marginBottom: 6 },
        invTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: '#E8501A', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' },
        sectionTitle: { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
        method: { width: '100%', padding: '14px 18px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, textAlign: 'left', transition: 'border-color .15s, background .15s' },
        mIcon: { fontSize: 26, width: 36, textAlign: 'center', flexShrink: 0 },
        mLabel: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 },
        mSub: { fontSize: 12, color: '#6b7280' },
        mArrow: { marginLeft: 'auto', color: '#d1d5db', fontSize: 20, flexShrink: 0 },
        back: { background: 'none', border: 'none', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 0 16px', display: 'block' },
        stepTitle: { fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 18 },
        inp: { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 10 },
        btn: c => ({ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, color: '#fff', background: c === 'green' ? 'linear-gradient(135deg,#059669,#10b981)' : c === 'blue' ? 'linear-gradient(135deg,#1B3A6B,#2563eb)' : c === 'purple' ? 'linear-gradient(135deg,#6b21a8,#9333ea)' : 'linear-gradient(135deg,#E8501A,#d4400f)' }),
        error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 },
        infoBox: (bg, border) => ({ background: bg || '#f0fdf4', border: `1px solid ${border || '#bbf7d0'}`, borderRadius: 12, padding: 20, marginBottom: 16 }),
        infoRow: { fontSize: 14, color: '#374151', marginBottom: 7 },
        pending: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 24, textAlign: 'center' },
        step: i => ({ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, color: '#374151', alignItems: 'flex-start' }),
        stepNum: { background: '#10b981', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
        success: { textAlign: 'center', padding: '10px 0' },
        footer: { textAlign: 'center', marginTop: 28, paddingTop: 18, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#9ca3af', lineHeight: 1.8 },
    };

    const METHODS = [
        { id: STEPS.MPESA_STK, icon: '💚', label: 'M-Pesa STK Push', sub: 'Instant prompt on your phone' },
        { id: STEPS.MPESA_MANUAL, icon: '📱', label: mpesaMode === 'buygoods' ? 'Lipa na M-Pesa (Till)' : 'M-Pesa Paybill', sub: 'Pay manually via M-Pesa menu' },
        { id: STEPS.BANK, icon: '🏦', label: 'Bank Transfer / EFT', sub: 'Pay directly to our bank account' },
        { id: STEPS.PESALINK, icon: '🔗', label: 'Pesalink', sub: 'Instant interbank transfer' },
        { id: STEPS.PESAPAL, icon: '💳', label: 'PesaPal (Card/Mobile)', sub: 'Pay secured Online' },
        { id: STEPS.CASH, icon: '💵', label: 'Cash Payment', sub: 'Pay in person' },
    ];

    return (
        <div style={S.page}>
            <div style={S.card}>

                {/* Header */}
                <div style={S.logo}>
                    <img src="/logo.png" alt="Logo" style={{ height: 64, marginBottom: 12, objectFit: 'contain' }} />
                    <div style={S.logoName}>{companyName || "Segecha Group"}</div>
                    <div style={S.logoSub}>🔒 Secure Payment Portal</div>
                </div>

                {/* Invoice summary — always visible */}
                <div style={S.invBox}>
                    <div style={S.invRow}><span style={{ color: '#6b7280' }}>Client</span><b>{client}</b></div>
                    <div style={S.invRow}><span style={{ color: '#6b7280' }}>Invoice</span><span style={{ fontFamily: 'monospace', color: '#1B3A6B', fontWeight: 700 }}>{invoiceId}</span></div>
                    <div style={S.invTotal}><span>Amount Due</span><span>{fmt(amount)}</span></div>
                </div>

                {/* ── SELECT METHOD ── */}
                {step === STEPS.SELECT && (
                    <>
                        <div style={S.sectionTitle}>Choose how to pay</div>
                        {METHODS.map(m => (
                            <button key={m.id} style={S.method}
                                onClick={() => { setStep(m.id); setError(''); }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B3A6B'; e.currentTarget.style.background = '#f8faff'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
                            >
                                <span style={S.mIcon}>{m.icon}</span>
                                <span>
                                    <div style={S.mLabel}>{m.label}</div>
                                    <div style={S.mSub}>{m.sub}</div>
                                </span>
                                <span style={S.mArrow}>›</span>
                            </button>
                        ))}
                    </>
                )}

                {/* ── MPESA STK PUSH ── */}
                {step === STEPS.MPESA_STK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💚 M-Pesa STK Push</div>
                        {stkPending ? (
                            <div style={S.pending}>
                                <div style={{ fontSize: 48, marginBottom: 14 }}>📲</div>
                                <div style={{ fontWeight: 800, fontSize: 17, color: '#92400e', marginBottom: 10 }}>Check your phone!</div>
                                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.7 }}>
                                    A payment request of <b>{fmt(amount)}</b> has been sent to <b>{phone}</b>.<br />
                                    Open M-Pesa and enter your PIN to complete the payment.
                                </div>
                                <div style={{ marginTop: 18, fontSize: 13, color: '#a16207' }}>Didn't receive it?</div>
                                <button style={{ ...S.btn('blue'), marginTop: 10, padding: '11px' }} onClick={() => setStkPending(false)}>Resend prompt</button>
                            </div>
                        ) : (
                            <>
                                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
                                    Enter the M-Pesa number registered to your account. We will send a payment prompt instantly — just enter your PIN to pay {fmt(amount)}.
                                </p>
                                {error && <div style={S.error}>{error}</div>}
                                <input style={S.inp} type="tel" placeholder="e.g. 0712 345 678" value={phone}
                                    onChange={e => setPhone(e.target.value)} maxLength={15} />
                                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                                    Amount to be charged: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b>
                                </div>
                                <button style={S.btn()} onClick={triggerSTK} disabled={loading}>
                                    {loading ? '⏳ Sending prompt...' : `Send M-Pesa Request — ${fmt(amount)}`}
                                </button>
                            </>
                        )}
                    </>
                )}

                {/* ── MPESA MANUAL (PAYBILL / TILL) ── */}
                {step === STEPS.MPESA_MANUAL && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>{mpesaMode === 'buygoods' ? '🛒 Lipa na M-Pesa (Till)' : '📱 M-Pesa Paybill'}</div>
                        <div style={S.infoBox()}>
                            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 14, marginBottom: 14 }}>Steps to pay on your phone:</div>
                            {mpesaMode === 'buygoods' ? (
                                [
                                    'Open M-Pesa on your phone',
                                    'Select Lipa na M-Pesa',
                                    'Select Buy Goods and Services',
                                    `Till Number: ${tillNumber || '—'}`,
                                    `Amount: KES ${amount.toLocaleString('en-KE')}`,
                                    'Enter your M-Pesa PIN and confirm',
                                    `Recipient: ${mpesaDisplayName || companyName}`
                                ].map((s, i) => (
                                    <div key={i} style={S.step(i)}>
                                        <span style={S.stepNum}>{i + 1}</span>
                                        <span style={{ paddingTop: 2 }}>{s}</span>
                                    </div>
                                ))
                            ) : (
                                [
                                    'Open M-Pesa on your phone',
                                    'Select Lipa na M-Pesa',
                                    'Select Pay Bill',
                                    `Business No: ${paybillNumber || '—'}`,
                                    `Account No: ${invoiceId}`,
                                    `Amount: KES ${amount.toLocaleString('en-KE')}`,
                                    'Enter your M-Pesa PIN and confirm',
                                    `Recipient: ${mpesaDisplayName || companyName}`
                                ].map((s, i) => (
                                    <div key={i} style={S.step(i)}>
                                        <span style={S.stepNum}>{i + 1}</span>
                                        <span style={{ paddingTop: 2 }}>{s}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button style={S.btn('green')} onClick={() => setStep(STEPS.SUCCESS)}>I've completed this payment ✓</button>
                    </>
                )}

                {/* ── BANK TRANSFER ── */}
                {step === STEPS.BANK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>🏦 Bank Transfer</div>
                        <div style={S.infoBox('#eff6ff', '#bfdbfe')}>
                            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 14, marginBottom: 14 }}>Bank Account Details</div>
                            {[
                                ['Bank', bankName || '—'],
                                ['Account Holder', bankAccountName || companyName],
                                ['Account Number', bankAccountNumber || '—'],
                                ['Branch / Code', bankBranch || '—'],
                                ['Reference', invoiceId],
                                ['Amount', fmt(amount)],
                            ].map(([l, v]) => (
                                <div key={l} style={S.infoRow}><span style={{ color: '#6b7280' }}>{l}: </span><b>{v}</b></div>
                            ))}
                        </div>
                        <div style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
                            ⚠️ Always use <b>{invoiceId}</b> as the reference so we can match your payment.
                        </div>
                        <button style={S.btn('blue')} onClick={() => setStep(STEPS.SUCCESS)}>I've made the transfer ✓</button>
                    </>
                )}

                {/* ── PESALINK ── */}
                {step === STEPS.PESALINK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>🔗 Pesalink</div>
                        <div style={S.infoBox('#fdf4ff', '#e9d5ff')}>
                            <div style={{ fontWeight: 700, color: '#6b21a8', fontSize: 14, marginBottom: 14 }}>Pay via Pesalink (Interbank)</div>
                            {[
                                'Open your bank\'s mobile app or internet banking',
                                'Select Send Money or Pesalink',
                                `Bank: ${pesalinkBank || bankName || '—'}`,
                                `Account/Phone: ${pesalinkAccount || '—'}`,
                                `Reference: ${invoiceId}`,
                                `Amount: ${fmt(amount)}`,
                            ].map((s, i) => (
                                <div key={i} style={S.step(i)}>
                                    <span style={{ ...S.stepNum, background: '#9333ea' }}>{i + 1}</span>
                                    <span style={{ paddingTop: 2 }}>{s}</span>
                                </div>
                            ))}
                        </div>
                        <button style={S.btn('purple')} onClick={() => setStep(STEPS.SUCCESS)}>I've completed the transfer ✓</button>
                    </>
                )}

                {/* ── PESAPAL (REPLACES CARD) ── */}
                {step === STEPS.PESAPAL && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💳 PesaPal Payment</div>
                        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
                            Securely complete your payment via PesaPal. You can pay using your Visa, Mastercard, or Mobile Money (M-Pesa, Airtel Money).
                        </p>
                        <div style={{ ...S.infoBox('#f8fafc', '#e2e8f0'), marginBottom: 20 }}>
                            <div style={S.infoRow}>Invoice: <b>{invoiceId}</b></div>
                            <div style={S.infoRow}>Amount: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b></div>
                        </div>
                        <div style={S.infoBox('#f0fdf4', '#bbf7d0')}>
                            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 13, marginBottom: 10 }}>Instructions:</div>
                            <div style={{ fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                                1. Click the button below to open the secure PesaPal checkout.<br/>
                                2. Choose your preferred payment method on the PesaPal page.<br/>
                                3. Once complete, you will be redirected back here.
                            </div>
                        </div>
                        <button style={S.btn()} onClick={() => {
                            // In a real implementation, this would call a backend endpoint 
                            // to get a PesaPal Order URL/Tracking ID.
                            // For now, we guide the user to the intent.
                            alert('PesaPal integration requires your PesaPal Merchant Key and Secret to be configured in the backend. Please contact support to enable live PesaPal billing.');
                        }}>
                            Open PesaPal Checkout — {fmt(amount)}
                        </button>
                    </>
                )}

                {/* ── CASH ── */}
                {step === STEPS.CASH && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💵 Cash Payment</div>
                        <div style={S.infoBox('#fffbeb', '#fde68a')}>
                            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14, marginBottom: 12 }}>Cash payment selected</div>
                            <div style={S.infoRow}>Invoice: <b>{invoiceId}</b></div>
                            <div style={S.infoRow}>Amount: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b></div>
                            <div style={{ marginTop: 12, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                                Please arrange cash payment directly with <b>{companyName}</b>. 
                                Use <b>{invoiceId}</b> as your reference when making the payment.
                            </div>
                        </div>
                        <button style={S.btn('blue')} onClick={() => setStep(STEPS.SUCCESS)}>Confirm cash payment intention ✓</button>
                    </>
                )}

                {/* ── SUCCESS ── */}
                {step === STEPS.SUCCESS && (
                    <div style={S.success}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#065f46', marginBottom: 12 }}>
                            Payment Submitted!
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.8, marginBottom: 24 }}>
                            Thank you, <b>{client}</b>.<br />
                            Your payment of <b style={{ color: '#E8501A' }}>{fmt(amount)}</b> for invoice <b>{invoiceId}</b> has been submitted.<br /><br />
                            <b>{companyName}</b> will confirm receipt and update your invoice shortly.
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>You can safely close this page.</div>
                    </div>
                )}

                {/* Footer */}
                <div style={S.footer}>
                    🔒 Secure · {companyName} · Nairobi, Kenya<br />
                    <span>For payment queries, contact us directly</span>
                </div>
            </div>
        </div>
    );
}
