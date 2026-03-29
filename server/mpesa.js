const axios = require('axios');

const BASE = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

async function getAccessToken(config = {}) {
    const key = config.mpesaKey || process.env.MPESA_CONSUMER_KEY;
    const secret = config.mpesaSecret || process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    
    const res = await axios.get(
        `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return res.data.access_token;
}

function getTimestamp() {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

function getPassword(shortcode, passkey, timestamp) {
    const raw = `${shortcode}${passkey}${timestamp}`;
    return Buffer.from(raw).toString('base64');
}

async function stkPush({ phone, amount, accountRef, description, config = {} }) {
    const token = await getAccessToken(config);
    const timestamp = getTimestamp();
    
    const shortcode = config.mpesaShortcode || process.env.MPESA_SHORTCODE;
    const passkey = config.mpesaPasskey || process.env.MPESA_PASSKEY;
    const password = getPassword(shortcode, passkey, timestamp);

    // Normalise: 0712345678 or +254712345678 → 254712345678
    const normalised = phone.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: normalised,
        PartyB: shortcode,
        PhoneNumber: normalised,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountRef,
        TransactionDesc: description,
    };

    const res = await axios.post(
        `${BASE}/mpesa/stkpush/v1/processrequest`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
}

async function b2cPayment({ phone, amount, commandID = 'BusinessPayment', remarks, occasion, config = {} }) {
    const token = await getAccessToken(config);
    const normalised = phone.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
        InitiatorName: config.mpesaInitiator || process.env.MPESA_INITIATOR,
        SecurityCredential: config.mpesaSecurityCredential || process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: commandID,
        Amount: Math.round(amount),
        PartyA: config.mpesaB2CShortcode || process.env.MPESA_B2C_SHORTCODE,
        PartyB: normalised,
        Remarks: remarks || 'Disbursement',
        QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
        ResultURL: process.env.MPESA_CALLBACK_URL,
        Occasion: occasion || ''
    };

    const res = await axios.post(
        `${BASE}/mpesa/b2c/v1/paymentrequest`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
}

async function b2bPayment({ receiverShortcode, amount, commandID = 'BusinessToBusinessTransfer', remarks, config = {} }) {
    const token = await getAccessToken(config);

    const payload = {
        Initiator: config.mpesaInitiator || process.env.MPESA_INITIATOR,
        SecurityCredential: config.mpesaSecurityCredential || process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: commandID,
        Amount: Math.round(amount),
        PartyA: config.mpesaB2CShortcode || process.env.MPESA_B2C_SHORTCODE, // Usually the float account
        PartyB: receiverShortcode,
        Remarks: remarks || 'Business Transfer',
        QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
        ResultURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: 'Refund',
        SenderIdentifierType: '4', // Shortcode
        RecieverIdentifierType: '4' // Shortcode
    };

    const res = await axios.post(
        `${BASE}/mpesa/b2b/v1/paymentrequest`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
}

module.exports = { stkPush, b2cPayment, b2bPayment };
