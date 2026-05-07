const pool = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    // Admin user
 const hashedPassword = await bcrypt.hash(
  process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
  12
);

const adminResult = await client.query(`
  INSERT INTO users (full_name, email, password_hash, role)
  VALUES ($1, $2, $3, 'admin')
  ON CONFLICT (email)
  DO UPDATE SET email = EXCLUDED.email
  RETURNING id
`, [
  'System Administrator',
  process.env.SEED_ADMIN_EMAIL || 'admin@propms.com',
  hashedPassword
]);

const adminId = adminResult.rows[0].id;

    // Manager user
    const managerId = uuidv4();
 const managerPass = await bcrypt.hash('Manager@123', 12);

const managerResult = await client.query(`
  INSERT INTO users (full_name, email, password_hash, role)
  VALUES ($1, $2, $3, 'manager')
  ON CONFLICT (email)
  DO UPDATE SET email = EXCLUDED.email
  RETURNING id
`, [
  'Emeka Okafor',
  'manager@propms.com',
  managerPass
]);

const managerId = managerResult.rows[0].id;
    // Properties
    const prop1Id = uuidv4();
    const prop2Id = uuidv4();
    const prop3Id = uuidv4();

    await client.query(`
      INSERT INTO properties (id, name, address, city, state, property_type, total_units, description, amenities, created_by)
      VALUES
        ($1, 'Lekki Phase 1 Complex', '24 Admiralty Way, Lekki Phase 1', 'Lagos', 'Lagos', 'residential', 12, 'Modern apartment complex with 24/7 security', ARRAY['Security', 'Generator', 'Water', 'CCTV'], $4),
        ($2, 'Maitama Heights', '7 Panama Street, Maitama', 'Abuja', 'FCT', 'residential', 8, 'Luxury flats in the heart of Maitama', ARRAY['Security', 'Generator', 'Swimming Pool', 'Gym'], $4),
        ($3, 'Wuse Commercial Plaza', '15 Wuse Zone 5', 'Abuja', 'FCT', 'commercial', 20, 'Premium commercial spaces', ARRAY['Generator', 'Parking', 'Elevator'], $4)
      ON CONFLICT DO NOTHING
    `, [prop1Id, prop2Id, prop3Id, adminId]);

    // Units for Property 1
    const unitIds1 = [];
    for (let i = 1; i <= 6; i++) {
      const uid = uuidv4();
      unitIds1.push(uid);
      await client.query(`
        INSERT INTO units (id, property_id, unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount, status)
        VALUES ($1, $2, $3, 'apartment', 3, 2, 120, $4, $5)
        ON CONFLICT DO NOTHING
      `, [uid, prop1Id, `Flat ${i}A`, 500000 + (i * 50000), i <= 4 ? 'occupied' : 'vacant']);
    }

    // Units for Property 2
    const unitIds2 = [];
    for (let i = 1; i <= 4; i++) {
      const uid = uuidv4();
      unitIds2.push(uid);
      await client.query(`
        INSERT INTO units (id, property_id, unit_number, unit_type, bedrooms, bathrooms, size_sqm, rent_amount, status)
        VALUES ($1, $2, $3, 'apartment', 4, 3, 180, $4, $5)
        ON CONFLICT DO NOTHING
      `, [uid, prop2Id, `Suite ${i}`, 1200000, i <= 3 ? 'occupied' : 'vacant']);
    }

    // Tenants
    const tenantData = [
      { name: 'Chukwuemeka Adebayo', phone: '+2348012345678', email: 'adebayo@email.com', prop: prop1Id, unit: unitIds1[0], rent: 500000, start: '2024-01-01', end: '2025-01-01' },
      { name: 'Ngozi Okonkwo', phone: '+2348023456789', email: 'ngozi@email.com', prop: prop1Id, unit: unitIds1[1], rent: 550000, start: '2024-03-01', end: '2025-03-01' },
      { name: 'Babatunde Fashola', phone: '+2348034567890', email: 'fashola@email.com', prop: prop1Id, unit: unitIds1[2], rent: 600000, start: '2024-06-01', end: '2025-06-01' },
      { name: 'Amina Kalu', phone: '+2348045678901', email: 'amina@email.com', prop: prop1Id, unit: unitIds1[3], rent: 650000, start: '2023-11-01', end: '2024-11-01' },
      { name: 'Ibrahim Musa', phone: '+2348056789012', email: 'ibrahim@email.com', prop: prop2Id, unit: unitIds2[0], rent: 1200000, start: '2024-02-01', end: '2025-02-01' },
      { name: 'Chidinma Eze', phone: '+2348067890123', email: 'chidinma@email.com', prop: prop2Id, unit: unitIds2[1], rent: 1200000, start: '2024-04-01', end: '2025-04-01' },
      { name: 'Oluwafemi Balogun', phone: '+2348078901234', email: 'femi@email.com', prop: prop2Id, unit: unitIds2[2], rent: 1200000, start: '2024-07-01', end: '2025-07-01' },
    ];

    const tenantIds = [];
    for (const t of tenantData) {
      const tid = uuidv4();
      tenantIds.push({ id: tid, ...t });
      const end = new Date(t.end);
      const status = end < new Date() ? 'expired' : 'active';
      await client.query(`
        INSERT INTO tenants (id, full_name, phone, email, property_id, unit_id, rent_amount, tenancy_start, tenancy_end, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
      `, [tid, t.name, t.phone, t.email, t.prop, t.unit, t.rent, t.start, t.end, status]);
    }

    // Payments
    let receiptNum = 1000;
    const paymentMethods = ['bank_transfer', 'cash', 'pos', 'online'];
    for (const tenant of tenantIds.slice(0, 5)) {
      for (let m = 0; m < 6; m++) {
        const payDate = new Date(tenant.start);
        payDate.setMonth(payDate.getMonth() + m);
        if (payDate > new Date()) break;
        receiptNum++;
        const periodFrom = new Date(payDate);
        const periodTo = new Date(payDate);
        periodTo.setMonth(periodTo.getMonth() + 1);
        await client.query(`
          INSERT INTO payments (id, receipt_number, tenant_id, property_id, amount, payment_date, payment_method, period_from, period_to, status, recorded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10)
          ON CONFLICT DO NOTHING
        `, [
          uuidv4(),
          `RCP-${receiptNum}`,
          tenant.id,
          tenant.prop,
          tenant.rent,
          payDate.toISOString().split('T')[0],
          paymentMethods[m % 4],
          periodFrom.toISOString().split('T')[0],
          periodTo.toISOString().split('T')[0],
          adminId
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seed data inserted successfully');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log(`   Admin: ${process.env.SEED_ADMIN_EMAIL || 'admin@propms.com'} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@123456'}`);
    console.log('   Manager: manager@propms.com / Manager@123');
 } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);

    // ❌ DO NOT exit the process
    throw err;

  } finally {
    client.release();

    // ❌ DO NOT close pool
    // pool.end();  <-- REMOVE THIS
  }
}

module.exports = seed;