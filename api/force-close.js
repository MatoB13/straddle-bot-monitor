const { Client } = require("pg");
const { resolveConnectionString, timingSafeEqual } = require("./_bots");

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

  const botParam = (req.body && req.body.bot) || req.query.bot;
  let connectionString;
  try {
    connectionString = resolveConnectionString(botParam);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (!connectionString) {
    res.status(500).json({ error: "DATABASE_URL pre tohto bota nie je nastaveny." });
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
