const { sql, ensureSchema, setCors, bcrypt } = require('./_db');
const crypto = require('crypto');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureSchema();
    const { name, phone, password, storeName } = req.body || {};
    if (!name || !phone || !password || !storeName) {
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
    await sql`INSERT INTO users (id, name, phone, password_hash, role, store_name) VALUES (${id}, ${name}, ${phone}, ${hash}, 'promoter', ${storeName})`;

    const DEFAULT_PRODUCTS = ['Shampoo', 'Conditioner', 'Hair Mask', 'Hair Serum', 'Urea Cream', 'Cleanser Gel', 'Moisturizing Gel'];
    const defaultCartons = DEFAULT_PRODUCTS.map(name => ({
      id: crypto.randomUUID(),
      name,
      unitsPerCarton: 0,
      cartonCount: 0,
      extraPieces: 0,
      clientName: '',
      threshold: null
    }));

    const VARIANT_GROUPS = [
      { parentName: 'Roll On', variants: [
        { label: 'Red', color: '#B23A2E' },
        { label: 'Pink', color: '#D46A93' },
        { label: 'Blue', color: '#2F6FB2' },
        { label: 'Black', color: '#23211D' }
      ]},
      { parentName: 'Skin Serum', variants: [
        { label: 'Niacinamide', color: '#B23A2E' },
        { label: 'Vitamin C', color: '#C98A2B' },
        { label: 'Hyaluronic', color: '#2F6FB2' }
      ]}
    ];
    VARIANT_GROUPS.forEach(group => {
      group.variants.forEach(v => {
        defaultCartons.push({
          id: crypto.randomUUID(),
          name: group.parentName + ' - ' + v.label,
          unitsPerCarton: 0,
          cartonCount: 0,
          extraPieces: 0,
          clientName: '',
          threshold: null,
          parentName: group.parentName,
          variantLabel: v.label,
          variantColor: v.color
        });
      });
    });
    await sql`
      INSERT INTO kv (key, value, updated_at) VALUES (${'storage-cartons-' + id}, ${JSON.stringify(defaultCartons)}, now())
      ON CONFLICT (key) DO NOTHING
    `;

    const token = crypto.randomUUID();
    await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${id})`;

    return res.status(200).json({ token, user: { id, name, phone, role: 'promoter', storeName } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
