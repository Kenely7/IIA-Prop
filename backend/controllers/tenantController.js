const { validationResult } = require('express-validator');
const pool = require('../config/db');

// @desc    Get all tenants
// @route   GET /api/tenants
const getTenants = async (req, res, next) => {
  try {
    const { property_id, status, search, expiring_soon } = req.query;
    let query = `
      SELECT t.*, p.name AS property_name, p.address AS property_address, u.unit_number,
        COALESCE(SUM(pay.amount), 0) AS total_paid,
        t.rent_amount * GREATEST(0,
          EXTRACT(YEAR FROM AGE(NOW(), t.tenancy_start)) * 12 +
          EXTRACT(MONTH FROM AGE(NOW(), t.tenancy_start)) + 1
        ) AS expected_total,
        t.tenancy_end < NOW() AS is_expired,
        t.tenancy_end BETWEEN NOW() AND NOW() + INTERVAL '30 days' AS expiring_soon
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      LEFT JOIN payments pay ON pay.tenant_id = t.id AND pay.status = 'confirmed'
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (property_id) { query += ` AND t.property_id = $${i}`; params.push(property_id); i++; }
    if (status) { query += ` AND t.status = $${i}`; params.push(status); i++; }
    if (search) { query += ` AND (t.full_name ILIKE $${i} OR t.phone ILIKE $${i} OR t.email ILIKE $${i})`; params.push(`%${search}%`); i++; }
    if (expiring_soon === 'true') { query += ` AND t.tenancy_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'`; }

    query += ' GROUP BY t.id, p.name, p.address, u.unit_number ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, tenants: result.rows });
  } catch (err) { next(err); }
};

// @desc    Get single tenant with payment history
// @route   GET /api/tenants/:id
const getTenant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantResult = await pool.query(`
      SELECT t.*, p.name AS property_name, p.address AS property_address, u.unit_number,
        COALESCE(SUM(pay.amount), 0) AS total_paid
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      LEFT JOIN payments pay ON pay.tenant_id = t.id AND pay.status = 'confirmed'
      WHERE t.id = $1
      GROUP BY t.id, p.name, p.address, u.unit_number
    `, [id]);

    if (!tenantResult.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const paymentsResult = await pool.query(
      'SELECT * FROM payments WHERE tenant_id = $1 ORDER BY payment_date DESC',
      [id]
    );

    const remindersResult = await pool.query(
      'SELECT * FROM reminders WHERE tenant_id = $1 ORDER BY sent_at DESC LIMIT 20',
      [id]
    );

    res.json({
      success: true,
      tenant: tenantResult.rows[0],
      payments: paymentsResult.rows,
      reminders: remindersResult.rows,
    });
  } catch (err) { next(err); }
};

// @desc    Create tenant
// @route   POST /api/tenants
const createTenant = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
      full_name, phone, email, nin, next_of_kin_name, next_of_kin_phone,
      property_id, unit_id, rent_amount, payment_frequency,
      tenancy_start, tenancy_end, security_deposit, notes
    } = req.body;

    // Check unit availability
    if (unit_id) {
      const unitCheck = await pool.query("SELECT status FROM units WHERE id = $1", [unit_id]);
      if (unitCheck.rows[0]?.status === 'occupied') {
        return res.status(400).json({ success: false, message: 'Unit is already occupied.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tenants (full_name, phone, email, nin, next_of_kin_name, next_of_kin_phone,
        property_id, unit_id, rent_amount, payment_frequency, tenancy_start, tenancy_end,
        security_deposit, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         CASE WHEN $12::date < NOW() THEN 'expired' ELSE 'active' END)
       RETURNING *`,
      [full_name, phone, email, nin, next_of_kin_name, next_of_kin_phone,
       property_id, unit_id, rent_amount, payment_frequency || 'monthly',
       tenancy_start, tenancy_end, security_deposit || 0, notes]
    );

    // Update unit status to occupied
    if (unit_id) {
      await pool.query("UPDATE units SET status = 'occupied' WHERE id = $1", [unit_id]);
    }

    res.status(201).json({ success: true, tenant: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Update tenant
// @route   PUT /api/tenants/:id
const updateTenant = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      full_name, phone, email, nin, next_of_kin_name, next_of_kin_phone,
      property_id, unit_id, rent_amount, payment_frequency,
      tenancy_start, tenancy_end, status, security_deposit, notes
    } = req.body;

    // Get the current tenant to detect unit changes
    const current = await client.query('SELECT unit_id FROM tenants WHERE id = $1', [id]);
    if (!current.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const oldUnitId = current.rows[0].unit_id;
    const newUnitId = unit_id || null;

    // If switching to a new unit, verify it's not occupied by another tenant
    if (newUnitId && newUnitId !== oldUnitId) {
      const unitCheck = await client.query("SELECT status FROM units WHERE id = $1", [newUnitId]);
      if (unitCheck.rows[0]?.status === 'occupied') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Selected unit is already occupied.' });
      }
    }

    const result = await client.query(
      `UPDATE tenants SET full_name=$1, phone=$2, email=$3, nin=$4, next_of_kin_name=$5, next_of_kin_phone=$6,
        property_id=$7, unit_id=$8, rent_amount=$9, payment_frequency=$10,
        tenancy_start=$11, tenancy_end=$12, status=$13, security_deposit=$14, notes=$15
       WHERE id=$16 RETURNING *`,
      [full_name, phone, email, nin, next_of_kin_name, next_of_kin_phone,
       property_id, newUnitId, rent_amount, payment_frequency, tenancy_start, tenancy_end,
       status, security_deposit, notes, id]
    );

    // Sync unit statuses when unit assignment changes
    if (oldUnitId && oldUnitId !== newUnitId) {
      // Free up old unit
      await client.query("UPDATE units SET status = 'vacant' WHERE id = $1", [oldUnitId]);
    }
    if (newUnitId && newUnitId !== oldUnitId) {
      // Mark new unit as occupied (only if tenant is active)
      const tenantStatus = result.rows[0].status;
      if (tenantStatus === 'active') {
        await client.query("UPDATE units SET status = 'occupied' WHERE id = $1", [newUnitId]);
      }
    }
    // If status changed to terminated/expired, free the unit
    if (newUnitId && (status === 'terminated' || status === 'expired')) {
      await client.query("UPDATE units SET status = 'vacant' WHERE id = $1", [newUnitId]);
    }

    await client.query('COMMIT');
    res.json({ success: true, tenant: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// @desc    Delete tenant
// @route   DELETE /api/tenants/:id
const deleteTenant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await pool.query('SELECT unit_id FROM tenants WHERE id = $1', [id]);
    if (!tenant.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    // Free up the unit
    if (tenant.rows[0].unit_id) {
      await pool.query("UPDATE units SET status = 'vacant' WHERE id = $1", [tenant.rows[0].unit_id]);
    }

    await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    res.json({ success: true, message: 'Tenant deleted.' });
  } catch (err) { next(err); }
};

// @desc    Get expiring tenancies
// @route   GET /api/tenants/expiring
const getExpiringTenants = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const result = await pool.query(`
      SELECT t.*, p.name AS property_name, u.unit_number,
        (t.tenancy_end - NOW()::date) AS days_remaining
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE t.status = 'active'
        AND t.tenancy_end BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
      ORDER BY t.tenancy_end ASC
    `, [days]);
    res.json({ success: true, tenants: result.rows });
  } catch (err) { next(err); }
};

// @desc    Get outstanding balances
// @route   GET /api/tenants/outstanding
const getOutstandingBalances = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT t.*, p.name AS property_name, u.unit_number,
        COALESCE(SUM(pay.amount), 0) AS total_paid,
        (t.rent_amount * GREATEST(1,
          EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
          EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
        )) - COALESCE(SUM(pay.amount), 0) AS outstanding
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      LEFT JOIN payments pay ON pay.tenant_id = t.id AND pay.status = 'confirmed'
      WHERE t.status IN ('active', 'expired')
      GROUP BY t.id, p.name, u.unit_number
      HAVING (t.rent_amount * GREATEST(1,
        EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
        EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
      )) - COALESCE(SUM(pay.amount), 0) > 0
      ORDER BY outstanding DESC
    `);
    res.json({ success: true, tenants: result.rows });
  } catch (err) { next(err); }
};

module.exports = { getTenants, getTenant, createTenant, updateTenant, deleteTenant, getExpiringTenants, getOutstandingBalances };
