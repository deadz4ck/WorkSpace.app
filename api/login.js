const { sql, ensureSchema, setCors, bcrypt } = require('./_db');
const crypto = require('crypto');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const { phone, password } = req.body || {};
    if (!phone || !password) return res.status(400).json({ error: 'Missing fields' });

    const rows = await sql`SELECT id, name, phone, password_hash, role FROM users WHERE phone = ${phone}`;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Incorrect phone number or password.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect phone number or password.' });

    const token = crypto.randomUUID();
    await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${user.id})`;

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
