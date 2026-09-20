const { sql, ensureSchema, setCors, bcrypt } = require('./_db');
const crypto = require('crypto');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const { name, phone, password } = req.body || {};
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const egyptPhone = /^(01[0-2,5]\d{8})$/;
    if (!egyptPhone.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid Egyptian number, e.g. 01012345678.' });
    }

    const existing = await sql`SELECT id FROM users WHERE phone = ${phone}`;
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this number already exists.' });
    }

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (id, name, phone, password_hash, role) VALUES (${id}, ${name}, ${phone}, ${hash}, 'promoter')`;

    const token = crypto.randomUUID();
    await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${id})`;

    return res.status(200).json({ token, user: { id, name, phone, role: 'promoter' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
