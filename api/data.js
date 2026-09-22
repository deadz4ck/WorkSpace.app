const { sql, ensureSchema, getUserFromRequest, setCors } = require('./_db');

const OWNED_PREFIXES = ['storage-cartons-', 'storage-stickers-', 'storage-history-', 'sales-'];

function canAccess(user, key, isWrite) {
  const privileged = user.role === 'admin' || user.role === 'manager';
  if (key === 'workspace-tree') return isWrite ? user.role === 'admin' : true;
  if (key.startsWith('img:') || key.startsWith('stickerimg:')) return true;
  for (const p of OWNED_PREFIXES) {
    if (key.startsWith(p)) {
      const ownerId = key.slice(p.length);
      return privileged || user.id === ownerId;
    }
  }
  return false;
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSchema();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    if (req.method === 'GET') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      if (!canAccess(user, key, false)) return res.status(403).json({ error: 'Forbidden' });
      const rows = await sql`SELECT value FROM kv WHERE key = ${key}`;
      return res.status(200).json({ value: rows[0] ? rows[0].value : null });
    }

    if (req.method === 'PUT') {
      const { key, value } = req.body || {};
      if (!key || value === undefined) return res.status(400).json({ error: 'Missing key/value' });
      if (!canAccess(user, key, true)) return res.status(403).json({ error: 'Forbidden' });
      await sql`
        INSERT INTO kv (key, value, updated_at) VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      if (!canAccess(user, key, true)) return res.status(403).json({ error: 'Forbidden' });
      await sql`DELETE FROM kv WHERE key = ${key}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
