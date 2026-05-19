const pool = require('../config/db');
const emailService = require('./emailService');
const smsService = require('./smsService');

const logReminder = async (tenant_id, type, channel, message, status, error = null) => {
  try {
    await pool.query(
      `INSERT INTO reminders (tenant_id, reminder_type, channel, message, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant_id, type, channel, message, status, error]
    );
  } catch (err) {
    console.error('Failed to log reminder:', err);
  }
};

const sendReminder = async (tenant, { type, channel = 'both', customMessage }) => {
  const results = { email: null, sms: null };

  let emailContent, smsText;

  if (customMessage) {
    emailContent = { subject: 'Message from PropMS', html: `<p>${customMessage}</p>` };
    smsText = customMessage;
  } else {
    switch (type) {
      case 'rent_due':
        emailContent = emailService.buildRentDueEmail(tenant, tenant.tenancy_end);
        smsText = smsService.buildRentDueSMS(tenant);
        break;
      case 'rent_overdue':
        emailContent = emailService.buildOverdueEmail(tenant, tenant.rent_amount);
        smsText = smsService.buildOverdueSMS(tenant, tenant.outstanding);
        break;
      case 'tenancy_expiry':
        emailContent = emailService.buildExpiryEmail(tenant, tenant.days_remaining);
        smsText = smsService.buildExpirySMS(tenant, tenant.days_remaining);
        break;
      default:
        emailContent = { subject: 'Notice from PropMS', html: `<p>Please contact PropMS regarding your tenancy.</p>` };
        smsText = 'Please contact PropMS regarding your tenancy.';
    }
  }

  // Send email
  if ((channel === 'email' || channel === 'both') && tenant.email) {
    try {
      await emailService.sendEmail({ to: tenant.email, ...emailContent });
      results.email = 'sent';
      await logReminder(tenant.id, type, 'email', emailContent.subject, 'sent');
    } catch (err) {
      results.email = `failed: ${err.message}`;
      await logReminder(tenant.id, type, 'email', emailContent.subject, 'failed', err.message);
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && tenant.phone) {
    try {
      await smsService.sendSMS(tenant.phone, smsText);
      results.sms = 'sent';
      await logReminder(tenant.id, type, 'sms', smsText, 'sent');
    } catch (err) {
      results.sms = `failed: ${err.message}`;
      await logReminder(tenant.id, type, 'sms', smsText, 'failed', err.message);
    }
  }

  return results;
};

// === DAILY REMINDER JOB ===
const runDailyReminders = async () => {
  console.log(`[CRON] Running daily reminders - ${new Date().toLocaleString()}`);
  const summary = { rent_due: 0, overdue: 0, expiry: 0, errors: 0 };

  try {
    // 1. Rent due reminders (tenants whose rent is due in 3 or 7 days)
    const rentDueTenants = await pool.query(`
      SELECT t.*, p.name AS property_name, u.unit_number,
        t.tenancy_start + (
          FLOOR(EXTRACT(DAY FROM AGE(NOW(), t.tenancy_start)) /
            CASE t.payment_frequency
              WHEN 'monthly' THEN 30
              WHEN 'quarterly' THEN 90
              WHEN 'biannually' THEN 180
              WHEN 'annually' THEN 365
            END
          ) + 1
        ) * (CASE t.payment_frequency
              WHEN 'monthly' THEN INTERVAL '30 days'
              WHEN 'quarterly' THEN INTERVAL '90 days'
              WHEN 'biannually' THEN INTERVAL '180 days'
              WHEN 'annually' THEN INTERVAL '365 days'
            END) AS next_due_date
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE t.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM reminders r
          WHERE r.tenant_id = t.id AND r.reminder_type = 'rent_due'
            AND r.sent_at > NOW() - INTERVAL '3 days' AND r.status = 'sent'
        )
    `);

    for (const tenant of rentDueTenants.rows) {
      const daysUntilDue = Math.ceil((new Date(tenant.next_due_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        try {
          await sendReminder(tenant, { type: 'rent_due', channel: 'both' });
          summary.rent_due++;
        } catch (e) { summary.errors++; }
      }
    }

    // 2. Overdue rent notices
    const overdueResult = await pool.query(`
      SELECT t.*, p.name AS property_name, u.unit_number,
        t.rent_amount * GREATEST(1,
          EXTRACT(YEAR FROM AGE(NOW()::date, t.tenancy_start)) * 12 +
          EXTRACT(MONTH FROM AGE(NOW()::date, t.tenancy_start)) + 1
        ) - COALESCE(pay_totals.paid, 0) AS outstanding
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      LEFT JOIN (
        SELECT tenant_id, SUM(amount) AS paid FROM payments WHERE status = 'confirmed' GROUP BY tenant_id
      ) pay_totals ON pay_totals.tenant_id = t.id
      WHERE t.status = 'active'
        AND (t.rent_amount * GREATEST(1,
          EXTRACT(YEAR FROM AGE(NOW()::date, t.tenancy_start)) * 12 +
          EXTRACT(MONTH FROM AGE(NOW()::date, t.tenancy_start)) + 1
        )) - COALESCE(pay_totals.paid, 0) > 0
        AND NOT EXISTS (
          SELECT 1 FROM reminders r
          WHERE r.tenant_id = t.id AND r.reminder_type = 'rent_overdue'
            AND r.sent_at > NOW() - INTERVAL '7 days' AND r.status = 'sent'
        )
    `);

    for (const tenant of overdueResult.rows) {
      try {
        await sendReminder(tenant, { type: 'rent_overdue', channel: 'both' });
        summary.overdue++;
      } catch (e) { summary.errors++; }
    }

    // 3. Tenancy expiry reminders (30 days and 7 days before)
    const expiryResult = await pool.query(`
      SELECT t.*, p.name AS property_name, u.unit_number,
        (t.tenancy_end - NOW()::date) AS days_remaining
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE t.status = 'active'
        AND t.tenancy_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM reminders r
          WHERE r.tenant_id = t.id AND r.reminder_type = 'tenancy_expiry'
            AND r.sent_at > NOW() - INTERVAL '7 days' AND r.status = 'sent'
        )
    `);

    for (const tenant of expiryResult.rows) {
      try {
        await sendReminder(tenant, { type: 'tenancy_expiry', channel: 'both' });
        summary.expiry++;
      } catch (e) { summary.errors++; }
    }

    console.log('[CRON] Reminders sent:', summary);
    return summary;
  } catch (err) {
    console.error('[CRON] Error:', err);
    throw err;
  }
};

module.exports = { sendReminder, runDailyReminders, logReminder };
