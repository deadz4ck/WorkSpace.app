const { sql, ensureSchema, getUserFromRequest, setCors } = require('./_db');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const actor = await getUserFromRequest(req);
    if (!actor) return res.status(401).json({ error: 'Not logged in' });
    if (actor.role !== 'admin' && actor.role !== 'manager') return res.status(403).json({ error: 'Forbidden' });

    const { promoterId, storeId } = req.body || {};
    if (!promoterId) return res.status(400).json({ error: 'Missing promoterId' });

    const promoterRows = await sql`SELECT id, role FROM users WHERE id = ${promoterId}`;
    if (!promoterRows[0] || promoterRows[0].role !== 'promoter') {
      return res.status(404).json({ error: 'Promoter not found' });
    }

    if (storeId) {
      const storeRows = await sql`SELECT id, name FROM stores WHERE id = ${storeId}`;
      if (!storeRows[0]) return res.status(404).json({ error: 'Store not found' });
      await sql`UPDATE users SET store_id = ${storeId} WHERE id = ${promoterId}`;
      return res.status(200).json({ ok: true, storeId, storeName: storeRows[0].name });
    } else {
      await sql`UPDATE users SET store_id = NULL WHERE id = ${promoterId}`;
      return res.status(200).json({ ok: true, storeId: null, storeName: null });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
