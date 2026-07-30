const { Client } = require("pg");

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = (req.body && req.body.token) || req.query.token || "";
  const expected = process.env.DASHBOARD_TOKEN || "";

  if (!expected || !timingSafeEqual(token, expected)) {
    res.status(401).json({ error: "Neplatny alebo chybajuci token." });
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    res.status(500).json({ error: "DATABASE_URL nie je nastaveny." });
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      "INSERT INTO straddle_commands (command_type, status) VALUES ('force_close_all', 'pending') RETURNING id"
    );
    res.status(200).json({ ok: true, commandId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    await client.end().catch(() => {});
  }
};
