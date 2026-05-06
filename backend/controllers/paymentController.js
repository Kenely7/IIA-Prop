const { validationResult } = require('express-validator');
const pool = require('../config/db');
const pdfService = require('../services/pdfService');

const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `RCP-${year}${month}-${rand}`;
};

// @desc    Get all payments
// @route   GET /api/payments
const getPayments = async (req, res, next) => {
  try {
    const { tenant_id, property_id, start_date, end_date, method, status } = req.query;
    let query = `
      SELECT pay.*, t.full_name AS tenant_name, t.phone AS tenant_phone,
        p.name AS property_name, u.unit_number
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (tenant_id) { query += ` AND pay.tenant_id = $${i}`; params.push(tenant_id); i++; }
    if (property_id) { query += ` AND pay.property_id = $${i}`; params.push(property_id); i++; }
    if (start_date) { query += ` AND pay.payment_date >= $${i}`; params.push(start_date); i++; }
    if (end_date) { query += ` AND pay.payment_date <= $${i}`; params.push(end_date); i++; }
    if (method) { query += ` AND pay.payment_method = $${i}`; params.push(method); i++; }
    if (status) { query += ` AND pay.status = $${i}`; params.push(status); i++; }

    query += ' ORDER BY pay.payment_date DESC, pay.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, payments: result.rows });
  } catch (err) { next(err); }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
const getPayment = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT pay.*, t.full_name AS tenant_name, t.phone AS tenant_phone, t.email AS tenant_email,
        p.name AS property_name, p.address AS property_address, u.unit_number
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE pay.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, payment: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Record a payment
// @route   POST /api/payments
const createPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { tenant_id, amount, payment_date, payment_method, period_from, period_to, notes } = req.body;

    const tenantResult = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenant_id]);
    if (!tenantResult.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const tenant = tenantResult.rows[0];
    const receipt_number = generateReceiptNumber();

    const result = await pool.query(
      `INSERT INTO payments (receipt_number, tenant_id, property_id, amount, payment_date, payment_method, period_from, period_to, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [receipt_number, tenant_id, tenant.property_id, amount, payment_date, payment_method || 'bank_transfer', period_from, period_to, notes, req.user.id]
    );

    const payment = result.rows[0];

    // Get full payment data for receipt
    const fullPayment = await pool.query(`
      SELECT pay.*, t.full_name AS tenant_name, t.phone AS tenant_phone, t.email AS tenant_email,
        p.name AS property_name, p.address AS property_address, u.unit_number
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE pay.id = $1
    `, [payment.id]);

    res.status(201).json({ success: true, payment: fullPayment.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, payment_date, payment_method, period_from, period_to, status, notes } = req.body;

    const result = await pool.query(
      `UPDATE payments SET amount=$1, payment_date=$2, payment_method=$3, period_from=$4, period_to=$5, status=$6, notes=$7
       WHERE id=$8 RETURNING *`,
      [amount, payment_date, payment_method, period_from, period_to, status, notes, id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, payment: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Delete / reverse payment
// @route   DELETE /api/payments/:id
const deletePayment = async (req, res, next) => {
  try {
    const result = await pool.query("UPDATE payments SET status = 'reversed' WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, message: 'Payment reversed.' });
  } catch (err) { next(err); }
};

// @desc    Generate PDF receipt
// @route   GET /api/payments/:id/receipt
const generateReceipt = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT pay.*, t.full_name AS tenant_name, t.phone AS tenant_phone, t.email AS tenant_email,
        p.name AS property_name, p.address AS property_address, u.unit_number
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE pay.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Payment not found.' });

    const pdfBuffer = await pdfService.generateReceipt(result.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${result.rows[0].receipt_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

// @desc    Get payment summary stats
// @route   GET /api/payments/stats
const getPaymentStats = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear(), property_id } = req.query;
    let propFilter = property_id ? `AND pay.property_id = '${property_id}'` : '';

    const monthlyResult = await pool.query(`
      SELECT EXTRACT(MONTH FROM payment_date) AS month, SUM(amount) AS total, COUNT(*) AS count
      FROM payments
      WHERE status = 'confirmed' AND EXTRACT(YEAR FROM payment_date) = $1 ${propFilter}
      GROUP BY month ORDER BY month
    `, [year]);

    const summaryResult = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'confirmed' AND EXTRACT(YEAR FROM payment_date) = $1 THEN amount ELSE 0 END) AS total_this_year,
        SUM(CASE WHEN status = 'confirmed' AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM NOW())
            AND EXTRACT(YEAR FROM payment_date) = $1 THEN amount ELSE 0 END) AS total_this_month,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count
      FROM payments ${property_id ? `WHERE property_id = '${property_id}'` : ''}
    `, [year]);

    res.json({
      success: true,
      monthly: monthlyResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (err) { next(err); }
};

module.exports = { getPayments, getPayment, createPayment, updatePayment, deletePayment, generateReceipt, getPaymentStats };
