const axios = require('axios');
require('dotenv').config();

// Termii SMS
const sendTermiiSMS = async (to, message) => {
  if (!process.env.TERMII_API_KEY) {
    console.log(`[SMS MOCK - Termii] To: ${to} | Message: ${message}`);
    return { status: 'mock', message_id: 'mock-' + Date.now() };
  }

  const response = await axios.post(`${process.env.TERMII_BASE_URL}/sms/send`, {
    to,
    from: process.env.TERMII_SENDER_ID || 'PropMS',
    sms: message,
    type: 'plain',
    channel: 'generic',
    api_key: process.env.TERMII_API_KEY,
  });

  return response.data;
};

// Africa's Talking SMS (alternative)
const sendATSMS = async (to, message) => {
  if (!process.env.AT_API_KEY) {
    console.log(`[SMS MOCK - AT] To: ${to} | Message: ${message}`);
    return { status: 'mock' };
  }

  const params = new URLSearchParams({
    username: process.env.AT_USERNAME,
    to,
    message,
    from: process.env.TERMII_SENDER_ID || 'PropMS',
  });

  const response = await axios.post('https://api.africastalking.com/version1/messaging', params.toString(), {
    headers: {
      'apiKey': process.env.AT_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
  });

  return response.data;
};

// Main SMS sender - uses Termii by default, falls back to AT
const sendSMS = async (phone, message) => {
  // Normalize Nigerian phone number
  let normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('0')) {
    normalized = '+234' + normalized.slice(1);
  }
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  try {
    if (process.env.TERMII_API_KEY) {
      return await sendTermiiSMS(normalized, message);
    } else if (process.env.AT_API_KEY) {
      return await sendATSMS(normalized, message);
    } else {
      console.log(`[SMS MOCK] To: ${normalized} | ${message}`);
      return { status: 'mock', to: normalized };
    }
  } catch (err) {
    console.error('SMS send error:', err.message);
    throw err;
  }
};

const buildRentDueSMS = (tenant) =>
  `Dear ${tenant.full_name}, your rent of ₦${Number(tenant.rent_amount).toLocaleString()} for ${tenant.property_name} is due. Please make payment to avoid penalties. - PropMS`;

const buildOverdueSMS = (tenant, outstanding) =>
  `NOTICE: Dear ${tenant.full_name}, rent arrears of ₦${Number(outstanding).toLocaleString()} for ${tenant.property_name} is overdue. Contact us immediately. - PropMS`;

const buildExpirySMS = (tenant, daysRemaining) =>
  `Dear ${tenant.full_name}, your tenancy at ${tenant.property_name} expires in ${daysRemaining} day(s). Please contact us for renewal. - PropMS`;

module.exports = { sendSMS, buildRentDueSMS, buildOverdueSMS, buildExpirySMS };
