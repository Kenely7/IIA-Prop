const pool = require('../config/db');

// @desc    Get dashboard summary stats
// @route   GET /api/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [properties, tenants, payments, expiring, outstanding, monthly] = await Promise.all([
      // Properties summary
      pool.query(`
        SELECT
          COUNT(*) AS total_properties,
          SUM(total_units) AS total_units,
          (SELECT COUNT(*) FROM units WHERE status = 'occupied') AS occupied_units,
          (SELECT COUNT(*) FROM units WHERE status = 'vacant') AS vacant_units
        FROM properties
      `),
      // Tenants summary
      pool.query(`
        SELECT
          COUNT(*) AS total_tenants,
          COUNT(*) FILTER (WHERE status = 'active') AS active_tenants,
          COUNT(*) FILTER (WHERE status = 'expired') AS expired_tenants
        FROM tenants
      `),
      // Payments summary
      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed' AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM NOW())), 0) AS total_rent_ytd,
          COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'
            AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM NOW())
            AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM NOW())), 0) AS total_rent_this_month,
          COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_payments,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_payments
        FROM payments
      `),
      // Expiring tenancies (next 30 days)
      pool.query(`
        SELECT t.id, t.full_name, t.phone, t.tenancy_end, p.name AS property_name, u.unit_number,
          (t.tenancy_end - NOW()::date) AS days_remaining
        FROM tenants t
        LEFT JOIN properties p ON p.id = t.property_id
        LEFT JOIN units u ON u.id = t.unit_id
        WHERE t.status = 'active' AND t.tenancy_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        ORDER BY t.tenancy_end ASC
        LIMIT 10
      `),
      // Outstanding balances (top 5)
      pool.query(`
        SELECT t.id, t.full_name, t.phone, p.name AS property_name,
          t.rent_amount * GREATEST(1,
            EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
            EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
          ) - COALESCE(SUM(pay.amount), 0) AS outstanding
        FROM tenants t
        LEFT JOIN properties p ON p.id = t.property_id
        LEFT JOIN payments pay ON pay.tenant_id = t.id AND pay.status = 'confirmed'
        WHERE t.status IN ('active', 'expired')
        GROUP BY t.id, p.name
        HAVING t.rent_amount * GREATEST(1,
          EXTRACT(YEAR FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) * 12 +
          EXTRACT(MONTH FROM AGE(LEAST(t.tenancy_end, NOW()::date), t.tenancy_start)) + 1
        ) - COALESCE(SUM(pay.amount), 0) > 0
        ORDER BY outstanding DESC
        LIMIT 5
      `),
      // Monthly trend (last 6 months)
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'Mon YY') AS month,
          SUM(amount) AS total, COUNT(*) AS count
        FROM payments
        WHERE status = 'confirmed' AND payment_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', payment_date)
        ORDER BY DATE_TRUNC('month', payment_date)
      `),
    ]);

    // Occupancy rate
    const totalUnits = parseInt(properties.rows[0].total_units) || 0;
    const occupiedUnits = parseInt(properties.rows[0].occupied_units) || 0;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    res.json({
      success: true,
      dashboard: {
        properties: properties.rows[0],
        tenants: tenants.rows[0],
        payments: payments.rows[0],
        occupancy_rate: occupancyRate,
        expiring_tenancies: expiring.rows,
        outstanding_balances: outstanding.rows,
        monthly_trend: monthly.rows,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getDashboard };
