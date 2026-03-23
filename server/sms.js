const AfricasTalking = require('africastalking');

let at;
const getAT = () => {
    if (!at) at = AfricasTalking({ username: process.env.AT_USERNAME, apiKey: process.env.AT_API_KEY });
    return at;
};

function normalisePhone(phone) {
    const p = String(phone || '').replace(/\s/g, '');
    if (p.startsWith('+')) return p;
    if (p.startsWith('254')) return '+' + p;
    return p.replace(/^0/, '+254');
}

async function sendPaymentSMS({ phone, clientName, invoiceId, amount, portalUrl }) {
    const normalised = normalisePhone(phone);

    const message = [
        `Hi ${clientName},`,
        `Payment request from Segecha Group Ltd.`,
        `Invoice: ${invoiceId}`,
        `Amount: KES ${Number(amount).toLocaleString('en-KE')}`,
        `Pay here: ${portalUrl}`,
        `M-Pesa, Card & Bank accepted.`,
    ].join('\n');

    await getAT().SMS.send({
        to: [normalised],
        message,
        from: process.env.AT_SENDER_ID || 'SEGECHA',
    });
}

/** Generic SMS (e.g. driver welcome) — requires AT_USERNAME / AT_API_KEY */
async function sendRawSMS({ phone, message }) {
    const normalised = normalisePhone(phone);
    await getAT().SMS.send({
        to: [normalised],
        message: String(message).slice(0, 480),
        from: process.env.AT_SENDER_ID || 'SEGECHA',
    });
}

module.exports = { sendPaymentSMS, sendRawSMS };
