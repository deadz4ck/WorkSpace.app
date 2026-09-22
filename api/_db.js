const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const sql = neon(process.env.DATABASE_URL);

function buildDefaultCartons() {
  const DEFAULT_PRODUCTS = ['Shampoo', 'Conditioner', 'Hair Mask', 'Hair Serum', 'Urea Cream', 'Cleanser Gel', 'Moisturizing Gel'];
  const cartons = DEFAULT_PRODUCTS.map(name => ({
    id: crypto.randomUUID(), name, unitsPerCarton: 0, cartonCount: 0, extraPieces: 0, clientName: '', threshold: null
  }));
  const VARIANT_GROUPS = [
    { parentName: 'Roll On', variants: [
      { label: 'Red', color: '#B23A2E' }, { label: 'Pink', color: '#D46A93' },
      { label: 'Blue', color: '#2F6FB2' }, { label: 'Black', color: '#23211D' }
    ]},
    { parentName: 'Skin Serum', variants: [
      { label: 'Niacinamide', color: '#B23A2E' }, { label: 'Vitamin C', color: '#C98A2B' }, { label: 'Hyaluronic', color: '#2F6FB2' }
    ]}
  ];
  VARIANT_GROUPS.forEach(group => {
    group.variants.forEach(v => {
      cartons.push({
        id: crypto.randomUUID(), name: group.parentName + ' - ' + v.label,
        unitsPerCarton: 0, cartonCount: 0, extraPieces: 0, clientName: '', threshold: null,
        parentName: group.parentName, variantLabel: v.label, variantColor: v.color
      });
    });
  });
  return cartons;
}

async function seedDefaultCartons(userId, keySuffix) {
  const key = 'storage-cartons-' + userId + (keySuffix || '');
  await sql`
    INSERT INTO kv (key, value, updated_at) VALUES (${key}, ${JSON.stringify(buildDefaultCartons())}, now())
    ON CONFLICT (key) DO NOTHING
  `;
}

let schemaReady = null;
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'promoter',
      store_name TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;

    const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    if (admins.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await sql`INSERT INTO users (id, name, phone, password_hash, role)
                VALUES ('admin', 'Admin', '01000000000', ${hash}, 'admin')
                ON CONFLICT (phone) DO NOTHING`;
    }
    await seedDefaultCartons('office', '-shared');
    await seedDefaultCartons('admin', '-factory');
  })();
  return schemaReady;
}

async function getUserFromRequest(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.name, u.phone, u.role, u.store_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
  `;
  if (!rows[0]) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, phone: r.phone, role: r.role, storeName: r.store_name };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { sql, ensureSchema, getUserFromRequest, setCors, bcrypt, buildDefaultCartons, seedDefaultCartons };
