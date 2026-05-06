const pool = require('../config/db');
const reminderService = require('../services/reminderService');

// @desc    Get reminder history
// @route   GET /api/reminders
const getReminders = async (req, res, next) => {
  try {
    const { tenant_id, type, status } = req.query;
    let query = `
      SELECT r.*, t.full_name AS tenant_name, t.phone, t.email
      FROM reminders r
      JOIN tenants t ON t.id = r.tenant_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (tenant_id) { query += ` AND r.tenant_id = $${i}`; params.push(tenant_id); i++; }
    if (type) { query += ` AND r.reminder_type = $${i}`; params.push(type); i++; }
    if (status) { query += ` AND r.status = $${i}`; params.push(status); i++; }
    query += ' ORDER BY r.sent_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json({ success: true, reminders: result.rows });
  } catch (err) { next(err); }
};

// @desc    Send manual reminder
// @route   POST /api/reminders/send
const sendManualReminder = async (req, res, next) => {
  try {
    const { tenant_id, channel, message, reminder_type } = req.body;

    const tenantResult = await pool.query(`
      SELECT t.*, p.name AS property_name FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      WHERE t.id = $1
    `, [tenant_id]);

    if (!tenantResult.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const tenant = tenantResult.rows[0];
    const result = await reminderService.sendReminder(tenant, {
      type: reminder_type || 'custom',
      channel: channel || 'both',
      customMessage: message,
    });

    res.json({ success: true, result });
  } catch (err) { next(err); }
};

// @desc    Run reminder job manually (admin)
// @route   POST /api/reminders/run-job
const runReminderJob = async (req, res, next) => {
  try {
    const results = await reminderService.runDailyReminders();
    res.json({ success: true, message: 'Reminder job completed', results });
  } catch (err) { next(err); }
};

module.exports = { getReminders, sendManualReminder, runReminderJob };
