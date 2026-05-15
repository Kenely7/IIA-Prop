const pool = require('../config/db');
const ExcelJS = require('exceljs');

// @desc    Get comprehensive reports
// @route   GET /api/reports
const getReports = async (req, res, next) => {
  try {
    const { property_id, start_date, end_date, year = new Date().getFullYear() } = req.query;
    const propFilter = property_id ? `AND property_id = '${property_id}'` : '';

    const [rentSummary, occupancy, outstanding, paymentMethods, propertyBreakdown] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE status='confirmed'), 0) AS total_collected,
          COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0) AS total_pending,
          COUNT(*) FILTER (WHERE status='confirmed') AS total_payments,
          AVG(amount) FILTER (WHERE status='confirmed') AS avg_payment
        FROM payments
        WHERE payment_date BETWEEN COALESCE($1, '2000-01-01') AND COALESCE($2, NOW()::date) ${propFilter}
      `, [start_date, end_date]),

      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'occupied') AS occupied,
          COUNT(*) FILTER (WHERE status = 'vacant') AS vacant,
          COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance,
          COUNT(*) AS total,
          ROUND(COUNT(*) FILTER (WHERE status = 'occupied')::decimal / NULLIF(COUNT(*), 0) * 100, 1) AS occupancy_rate
        FROM units
      `),

      pool.query(`
        SELECT COUNT(*) AS defaulters,
          COALESCE(SUM(
            t.rent_amount * GREATEST(1,
              EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
              EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
            ) - COALESCE(pay_totals.paid, 0)
          ), 0) AS total_outstanding
        FROM tenants t
        LEFT JOIN (
          SELECT tenant_id, SUM(amount) AS paid FROM payments WHERE status = 'confirmed' GROUP BY tenant_id
        ) pay_totals ON pay_totals.tenant_id = t.id
        WHERE t.status IN ('active', 'expired')
          AND (t.rent_amount * GREATEST(1,
            EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
            EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
          )) - COALESCE(pay_totals.paid, 0) > 0
      `),

      pool.query(`
        SELECT payment_method, COUNT(*) AS count, SUM(amount) AS total
        FROM payments WHERE status = 'confirmed' ${propFilter}
        GROUP BY payment_method ORDER BY total DESC
      `),

      pool.query(`
        SELECT p.name, p.address, p.property_type,
          COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') AS active_tenants,
          COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
          COUNT(DISTINCT u.id) AS total_units,
          COALESCE(SUM(pay.amount) FILTER (WHERE pay.status='confirmed'), 0) AS total_rent_collected,
          ROUND(COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'occupied')::decimal / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 1) AS occupancy_rate
        FROM properties p
        LEFT JOIN units u ON u.property_id = p.id
        LEFT JOIN tenants t ON t.property_id = p.id
        LEFT JOIN payments pay ON pay.property_id = p.id
        GROUP BY p.id ORDER BY total_rent_collected DESC
      `),
    ]);

    res.json({
      success: true,
      reports: {
        rent_summary: rentSummary.rows[0],
        occupancy: occupancy.rows[0],
        outstanding: outstanding.rows[0],
        payment_methods: paymentMethods.rows,
        property_breakdown: propertyBreakdown.rows,
      },
    });
  } catch (err) { next(err); }
};

// @desc    Export payments to Excel
// @route   GET /api/reports/export/excel
const exportExcel = async (req, res, next) => {
  try {
    const { start_date, end_date, property_id } = req.query;
    let query = `
      SELECT pay.receipt_number, t.full_name AS tenant, t.phone, p.name AS property,
        u.unit_number, pay.amount, pay.payment_date, pay.payment_method,
        pay.period_from, pay.period_to, pay.status, pay.notes
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (start_date) { query += ` AND pay.payment_date >= $${i}`; params.push(start_date); i++; }
    if (end_date) { query += ` AND pay.payment_date <= $${i}`; params.push(end_date); i++; }
    if (property_id) { query += ` AND pay.property_id = $${i}`; params.push(property_id); i++; }
    query += ' ORDER BY pay.payment_date DESC';

    const result = await pool.query(query, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PropMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Payments Report', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    sheet.columns = [
      { header: 'Receipt No.', key: 'receipt_number', width: 20 },
      { header: 'Tenant', key: 'tenant', width: 25 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Property', key: 'property', width: 30 },
      { header: 'Unit', key: 'unit_number', width: 12 },
      { header: 'Amount (₦)', key: 'amount', width: 18 },
      { header: 'Payment Date', key: 'payment_date', width: 15 },
      { header: 'Method', key: 'payment_method', width: 15 },
      { header: 'Period From', key: 'period_from', width: 15 },
      { header: 'Period To', key: 'period_to', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];

    // Style header
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    result.rows.forEach((row) => {
      const dataRow = sheet.addRow(row);
      dataRow.getCell('amount').numFmt = '₦#,##0.00';
      // Color confirmed green, others orange
      if (row.status === 'confirmed') {
        dataRow.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
      }
    });

    // Summary row
    const total = result.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const summaryRow = sheet.addRow({ receipt_number: 'TOTAL', amount: total });
    summaryRow.font = { bold: true };
    summaryRow.getCell('amount').numFmt = '₦#,##0.00';

    // Tenants sheet
    const tenantSheet = workbook.addWorksheet('Tenants');
    const tenantResult = await pool.query(`
      SELECT t.full_name, t.phone, t.email, p.name AS property, u.unit_number,
        t.rent_amount, t.tenancy_start, t.tenancy_end, t.status,
        t.payment_frequency, t.security_deposit
      FROM tenants t
      LEFT JOIN properties p ON p.id = t.property_id
      LEFT JOIN units u ON u.id = t.unit_id
      ORDER BY p.name, t.full_name
    `);

    tenantSheet.columns = [
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Property', key: 'property', width: 30 },
      { header: 'Unit', key: 'unit_number', width: 12 },
      { header: 'Rent (₦)', key: 'rent_amount', width: 18 },
      { header: 'Start Date', key: 'tenancy_start', width: 15 },
      { header: 'End Date', key: 'tenancy_end', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Frequency', key: 'payment_frequency', width: 15 },
    ];

    tenantSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
    });

    tenantResult.rows.forEach((row) => {
      const r = tenantSheet.addRow(row);
      r.getCell('rent_amount').numFmt = '₦#,##0.00';
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PropMS-Report-${new Date().toISOString().split('T')[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

// @desc    Export payments to CSV
// @route   GET /api/reports/export/csv
const exportCSV = async (req, res, next) => {
  try {
    const { start_date, end_date, property_id } = req.query;
    let query = `
      SELECT pay.receipt_number, t.full_name AS tenant, t.phone, p.name AS property,
        u.unit_number, pay.amount, pay.payment_date, pay.payment_method,
        pay.period_from, pay.period_to, pay.status
      FROM payments pay
      JOIN tenants t ON t.id = pay.tenant_id
      JOIN properties p ON p.id = pay.property_id
      LEFT JOIN units u ON u.id = t.unit_id WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (start_date) { query += ` AND pay.payment_date >= $${i}::date`; params.push(start_date); i++; }
    if (end_date) { query += ` AND pay.payment_date <= $${i}::date`; params.push(end_date); i++; }
    if (property_id) { query += ` AND pay.property_id = $${i}`; params.push(property_id); i++; }
    query += ' ORDER BY pay.payment_date DESC';

    const result = await pool.query(query, params);

    const headers = ['Receipt No,Tenant,Phone,Property,Unit,Amount,Date,Method,Period From,Period To,Status'];
    const rows = result.rows.map((r) =>
      [r.receipt_number, `"${r.tenant}"`, r.phone, `"${r.property}"`, r.unit_number || '',
        r.amount, r.payment_date?.toISOString?.()?.split('T')[0] || r.payment_date,
        r.payment_method, r.period_from?.toISOString?.()?.split('T')[0] || r.period_from,
        r.period_to?.toISOString?.()?.split('T')[0] || r.period_to, r.status].join(',')
    );

    const csv = [...headers, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};

module.exports = { getReports, exportExcel, exportCSV };
