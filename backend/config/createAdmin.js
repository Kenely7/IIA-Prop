// Create or update an admin user.
// Usage: npm run create-admin -- "Full Name" admin@example.com "StrongPassword"
// Or set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env and run: npm run create-admin
const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./db');
const migrate = require('./migrate');

async function createAdmin() {
  const [argName, argEmail, argPassword] = process.argv.slice(2);
  const fullName = argName || process.env.ADMIN_NAME || 'System Administrator';
  const email = (argEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = argPassword || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Provide an email and password (as arguments or ADMIN_EMAIL / ADMIN_PASSWORD in .env).');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    // Make sure the schema exists on a fresh database
    await migrate();

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'admin', true)
      ON CONFLICT (email)
      DO UPDATE SET full_name = EXCLUDED.full_name,
                    password_hash = EXCLUDED.password_hash,
                    role = 'admin',
                    is_active = true
      RETURNING id, full_name, email, role, (xmax = 0) AS created
    `, [fullName, email, passwordHash]);

    const user = result.rows[0];
    console.log(`✅ Admin ${user.created ? 'created' : 'updated'}: ${user.full_name} <${user.email}>`);
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
