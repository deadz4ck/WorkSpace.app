const { sql, ensureSchema, getUserFromRequest, setCors } = require('./_db');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });

    const rows = await sql`
      SELECT u.id, u.name, u.phone, u.role, u.store_id, s.name AS store_name
      FROM users u LEFT JOIN stores s ON s.id = u.store_id
      ORDER BY u.created_at ASC
    `;
    return res.status(200).json({ users: rows.map(r => ({ id: r.id, name: r.name, phone: r.phone, role: r.role, storeId: r.store_id, storeName: r.store_name })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
