const { validationResult } = require('express-validator');
const pool = require('../config/db');

// @desc    Get all properties with stats
// @route   GET /api/properties
const getProperties = async (req, res, next) => {
  try {
    const { search, type, state } = req.query;
    let query = `
      SELECT
        p.*,
        COUNT(DISTINCT u.id) AS unit_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') AS active_tenants,
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'vacant') AS vacant_units,
        COALESCE(SUM(pay.amount) FILTER (WHERE EXTRACT(YEAR FROM pay.payment_date) = EXTRACT(YEAR FROM NOW())), 0) AS total_rent_ytd
      FROM properties p
      LEFT JOIN units u ON u.property_id = p.id
      LEFT JOIN tenants t ON t.property_id = p.id
      LEFT JOIN payments pay ON pay.property_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;

    if (search) { query += ` AND (p.name ILIKE $${i} OR p.address ILIKE $${i})`; params.push(`%${search}%`); i++; }
    if (type) { query += ` AND p.property_type = $${i}`; params.push(type); i++; }
    if (state) { query += ` AND p.state ILIKE $${i}`; params.push(state); i++; }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, properties: result.rows });
  } catch (err) { next(err); }
};

// @desc    Get single property
// @route   GET /api/properties/:id
const getProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const propResult = await pool.query(`
      SELECT p.*,
        COUNT(DISTINCT u.id) AS unit_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') AS active_tenants,
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'occupied') AS occupied_units,
        COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'vacant') AS vacant_units
      FROM properties p
      LEFT JOIN units u ON u.property_id = p.id
      LEFT JOIN tenants t ON t.property_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!propResult.rows[0]) return res.status(404).json({ success: false, message: 'Property not found.' });

    const unitsResult = await pool.query('SELECT * FROM units WHERE property_id = $1 ORDER BY unit_number', [id]);
    const tenantsResult = await pool.query(`
      SELECT t.*, u.unit_number FROM tenants t
      LEFT JOIN units u ON u.id = t.unit_id
      WHERE t.property_id = $1 ORDER BY t.created_at DESC
    `, [id]);

    res.json({
      success: true,
      property: propResult.rows[0],
      units: unitsResult.rows,
      tenants: tenantsResult.rows,
    });
  } catch (err) { next(err); }
};

// @desc    Create property
// @route   POST /api/properties
const createProperty = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, address, city, state, property_type, total_units, description, amenities } = req.body;
    const result = await pool.query(
      `INSERT INTO properties (name, address, city, state, property_type, total_units, description, amenities, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, address, city, state, property_type || 'residential', total_units || 1, description, amenities || [], req.user.id]
    );

    res.status(201).json({ success: true, property: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Update property
// @route   PUT /api/properties/:id
const updateProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, city, state, property_type, total_units, description, amenities } = req.body;

    const result = await pool.query(
      `UPDATE properties SET name=$1, address=$2, city=$3, state=$4, property_type=$5, total_units=$6, description=$7, amenities=$8
       WHERE id=$9 RETURNING *`,
      [name, address, city, state, property_type, total_units, description, amenities || [], id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Property not found.' });
    res.json({ success: true, property: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const activeTenants = await pool.query("SELECT id FROM tenants WHERE property_id = $1 AND status = 'active'", [id]);
    if (activeTenants.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete property with active tenants.' });
    }

    const result = await pool.query('DELETE FROM properties WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Property not found.' });
    res.json({ success: true, message: 'Property deleted successfully.' });
  } catch (err) { next(err); }
};

// @desc    Get units for a property
// @route   GET /api/properties/:id/units
const getUnits = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT u.*, t.full_name AS tenant_name, t.id AS tenant_id
      FROM units u
      LEFT JOIN tenants t ON t.unit_id = u.id AND t.status = 'active'
      WHERE u.property_id = $1
      ORDER BY u.unit_number
    `, [id]);
    res.json({ success: true, units: result.rows });
  } catch (err) { next(err); }
};

// @desc    Add unit to property
// @route   POST /api/properties/:id/units
const addUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount } = req.body;

    const result = await pool.query(
      `INSERT INTO units (property_id, unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, unit_number, unit_type || 'apartment', bedrooms || 1, bathrooms || 1, size_sqm, rent_amount]
    );

    // Update total_units count
    await pool.query('UPDATE properties SET total_units = (SELECT COUNT(*) FROM units WHERE property_id = $1) WHERE id = $1', [id]);

    res.status(201).json({ success: true, unit: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Update a unit
// @route   PUT /api/properties/:id/units/:unitId
const updateUnit = async (req, res, next) => {
  try {
    const { unitId } = req.params;
    const { unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount, status } = req.body;

    // Prevent manually marking occupied unit as vacant if a tenant is in it
    if (status === 'vacant') {
      const tenant = await pool.query("SELECT id FROM tenants WHERE unit_id = $1 AND status = 'active'", [unitId]);
      if (tenant.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Cannot mark unit as vacant while an active tenant is assigned.' });
      }
    }

    const result = await pool.query(
      `UPDATE units SET unit_number=$1, unit_type=$2, bedrooms=$3, bathrooms=$4, size_sqm=$5, rent_amount=$6, status=$7
       WHERE id=$8 RETURNING *`,
      [unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount, status, unitId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Unit not found.' });
    res.json({ success: true, unit: result.rows[0] });
  } catch (err) { next(err); }
};

// @desc    Delete a unit
// @route   DELETE /api/properties/:id/units/:unitId
const deleteUnit = async (req, res, next) => {
  try {
    const { id, unitId } = req.params;
    const tenant = await pool.query("SELECT id FROM tenants WHERE unit_id = $1 AND status = 'active'", [unitId]);
    if (tenant.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete unit with an active tenant.' });
    }
    await pool.query('DELETE FROM units WHERE id = $1 AND property_id = $2', [unitId, id]);
    // Recalculate total_units
    await pool.query('UPDATE properties SET total_units = (SELECT COUNT(*) FROM units WHERE property_id = $1) WHERE id = $1', [id]);
    res.json({ success: true, message: 'Unit deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getProperties, getProperty, createProperty, updateProperty, deleteProperty, getUnits, addUnit, updateUnit, deleteUnit };
