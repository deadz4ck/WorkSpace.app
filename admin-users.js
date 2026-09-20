const { sql, ensureSchema, getUserFromRequest, setCors } = require('./_db');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const rows = await sql`SELECT id, name, phone, role FROM users ORDER BY created_at ASC`;
    return res.status(200).json({ users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
