const cron = require('node-cron');
const reminderService = require('../services/reminderService');
const pool = require('../config/db');

const initCronJobs = () => {
  console.log('⏰ Cron jobs initialized');

  // Daily reminder job - runs every day at 8:00 AM Nigerian time (UTC+1 = 07:00 UTC)
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Daily reminders triggered');
    try {
      await reminderService.runDailyReminders();
    } catch (err) {
      console.error('[CRON] Daily reminders failed:', err);
    }
  }, {
    timezone: 'Africa/Lagos',
  });

  // Tenancy status update job - runs daily at midnight
  // Auto-marks tenancies as expired when end date passes
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Updating expired tenancies');
    try {
      const result = await pool.query(`
        UPDATE tenants SET status = 'expired'
        WHERE status = 'active' AND tenancy_end < NOW()::date
        RETURNING id, full_name
      `);

      if (result.rows.length > 0) {
        console.log(`[CRON] Marked ${result.rows.length} tenancies as expired`);

        // Free up units for expired tenants
        await pool.query(`
          UPDATE units SET status = 'vacant'
          WHERE id IN (
            SELECT unit_id FROM tenants
            WHERE status = 'expired' AND unit_id IS NOT NULL
              AND tenancy_end < NOW()::date - INTERVAL '1 day'
          )
        `);
      }
    } catch (err) {
      console.error('[CRON] Tenancy update failed:', err);
    }
  }, {
    timezone: 'Africa/Lagos',
  });

  // Weekly overdue summary report (Mondays at 9am)
  cron.schedule('0 9 * * 1', async () => {
    console.log('[CRON] Weekly overdue summary');
    try {
      const overdue = await pool.query(`
        SELECT COUNT(*) AS count, SUM(
          t.rent_amount * GREATEST(1,
            EXTRACT(YEAR FROM AGE(NOW()::date, t.tenancy_start)) * 12 +
            EXTRACT(MONTH FROM AGE(NOW()::date, t.tenancy_start)) + 1
          ) - COALESCE(pay_totals.paid, 0)
        ) AS total_outstanding
        FROM tenants t
        LEFT JOIN (
          SELECT tenant_id, SUM(amount) AS paid FROM payments WHERE status = 'confirmed' GROUP BY tenant_id
        ) pay_totals ON pay_totals.tenant_id = t.id
        WHERE t.status IN ('active', 'expired')
          AND (t.rent_amount * GREATEST(1,
            EXTRACT(YEAR FROM AGE(NOW()::date, t.tenancy_start)) * 12 +
            EXTRACT(MONTH FROM AGE(NOW()::date, t.tenancy_start)) + 1
          )) - COALESCE(pay_totals.paid, 0) > 0
      `);

      console.log(`[CRON] Weekly summary: ${overdue.rows[0].count} defaulters, ₦${Number(overdue.rows[0].total_outstanding || 0).toLocaleString()} outstanding`);
    } catch (err) {
      console.error('[CRON] Weekly summary failed:', err);
    }
  }, { timezone: 'Africa/Lagos' });
};

module.exports = { initCronJobs };
