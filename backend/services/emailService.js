const {Resend} = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Mock mode
    if (!process.env.RESEND_API_KEY) {
      console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return { id: 'mock-' + Date.now() };
    }

    const info = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'PropMS <onboarding@resend.dev>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    console.log('✅ Email sent:', info);

    return info;
  } catch (error) {
    console.error('❌ Resend Email Error:', error);
    throw error;
  }
};

const buildRentDueEmail = (tenant, tenancy_end) => ({
  subject: `Rent Due Reminder — ${tenant.property_name}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1B4332; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">PropMS — Rent Reminder</h2>
      </div>
      <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e0e0e0;">
        <p>Dear <strong>${tenant.full_name}</strong>,</p>
        <p>This is a friendly reminder that your rent is due on <strong>${new Date(tenancy_end).toLocaleDateString('en-NG', { dateStyle: 'long' })}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #e8f5e9;">
            <td style="padding: 12px; border: 1px solid #751414;"><strong>Property</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${tenant.property_name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;"><strong>Unit</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${tenant.unit_number || 'N/A'}</td>
          </tr>
          <tr style="background: #e8f5e9;">
            <td style="padding: 12px; border: 1px solid #ddd;"><strong>Amount Due</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd; font-size: 18px; color: #1B4332;"><strong>₦${Number(rent_amount).toLocaleString()}</strong></td>
          </tr>
        </table>
        <p>Please make payment on time to avoid penalties.</p>
        <p style="color: #999; font-size: 12px;">PropMS Property Management System</p>
      </div>
    </div>
  `,
});

const buildOverdueEmail = (tenant, rent_amount) => ({
  subject: `⚠️ Overdue Rent Notice — ${tenant.property_name}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #C0392B; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">⚠️ Overdue Rent Notice</h2>
      </div>
      <div style="padding: 24px; background: #fff8f8; border: 1px solid #e0e0e0;">
        <p>Dear <strong>${tenant.full_name}</strong>,</p>
        <p>Your rent payment is <strong>overdue</strong>. Please make payment immediately to avoid further action.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #fce4e4;">
            <td style="padding: 12px; border: 1px solid #ddd;"><strong>Outstanding Amount</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd; color: #C0392B; font-size: 20px;"><strong>₦${Number(rent_amount).toLocaleString()}</strong></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;"><strong>Property</strong></td>
            <td style="padding: 12px; border: 1px solid #ddd;">${tenant.property_name}</td>
          </tr>
        </table>
        <p><strong>Please contact us immediately to resolve this.</strong></p>
      </div>
    </div>
  `,
});

const buildExpiryEmail = (tenant, daysRemaining) => ({
  subject: `Tenancy Expiry Notice — ${daysRemaining} days remaining`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #F39C12; padding: 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">Tenancy Expiry Notice</h2>
      </div>
      <div style="padding: 24px; background: #fffdf0; border: 1px solid #e0e0e0;">
        <p>Dear <strong>${tenant.full_name}</strong>,</p>
        <p>Your tenancy at <strong>${tenant.property_name}</strong> expires in <strong>${daysRemaining} day(s)</strong> on <strong>${new Date(tenant.tenancy_end).toLocaleDateString('en-NG', { dateStyle: 'long' })}</strong>.</p>
        <p>Please contact our office to discuss renewal options.</p>
      </div>
    </div>
  `,
});

module.exports = { sendEmail, buildRentDueEmail, buildOverdueEmail, buildExpiryEmail };
