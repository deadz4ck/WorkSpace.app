const { sql, ensureSchema, getUserFromRequest, setCors, seedDefaultCartons } = require('./_db');
const crypto = require('crypto');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSchema();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'GET') {
      const stores = await sql`SELECT id, name FROM stores ORDER BY name ASC`;
      const counts = await sql`SELECT store_id, COUNT(*) as cnt FROM users WHERE role = 'promoter' AND store_id IS NOT NULL GROUP BY store_id`;
      const countMap = {};
      counts.forEach(c => { countMap[c.store_id] = Number(c.cnt); });
      return res.status(200).json({
        stores: stores.map(s => ({ id: s.id, name: s.name, promoterCount: countMap[s.id] || 0 }))
      });
    }

    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name || !name.trim()) return res.status(400).json({ error: 'Store name required' });
      const id = crypto.randomUUID();
      await sql`INSERT INTO stores (id, name) VALUES (${id}, ${name.trim()})`;
      await seedDefaultCartons('store-' + id, '');
      return res.status(200).json({ store: { id, name: name.trim() } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
