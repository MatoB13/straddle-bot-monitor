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
  const token = req.query.token || "";
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

    const openResult = await client.query(
      `SELECT id, trade_group_id, wallet, side, dry_run, entry_ts_ms, entry_price,
              sl_price, tp_price, liq_price, notional_usd, tp_touched, tp_armed, tp_peak
       FROM straddle_trades
       WHERE exit_ts_ms IS NULL AND dry_run = false
       ORDER BY entry_ts_ms DESC`
    );

    const closedResult = await client.query(
      `SELECT id, trade_group_id, wallet, side, dry_run, entry_ts_ms, entry_price,
              exit_ts_ms, exit_price, exit_reason, sl_price, tp_price, liq_price,
              pnl_pct_raw, fee_pct, pnl_pct_net, notional_usd, pnl_usd_net, funding_usd
       FROM straddle_trades
       WHERE exit_ts_ms IS NOT NULL AND dry_run = false
       ORDER BY exit_ts_ms DESC
       LIMIT 2000`
    );

    const eventsResult = await client.query(
      `SELECT id, ts_ms, event_type, severity, message
       FROM straddle_runtime_events
       ORDER BY ts_ms DESC
       LIMIT 100`
    );

    const priceHistoryResult = await client.query(
      `SELECT ts_ms, price
       FROM straddle_price_snapshots
       WHERE ts_ms >= $1
       ORDER BY ts_ms ASC`,
      [Date.now() - 25 * 3600 * 1000]
    );

    const walletBalancesResult = await client.query(
      `SELECT wallet, wallet_balance_usd, available_balance_usd, unrealized_pnl_usd, updated_ts_ms
       FROM straddle_wallet_balances
       ORDER BY wallet`
    );

    const haltResult = await client.query(
      `SELECT halted, reason, halted_ts_ms FROM straddle_halt_state WHERE id = 1`
    );

    const configResult = await client.query(
      `SELECT message FROM straddle_runtime_events
       WHERE event_type = 'CONFIG_SNAPSHOT'
       ORDER BY ts_ms DESC LIMIT 1`
    );
    let configSnapshot = null;
    if (configResult.rows.length) {
      try {
        configSnapshot = JSON.parse(configResult.rows[0].message);
      } catch (err) {
        console.error("CONFIG_SNAPSHOT parse zlyhal:", err.message);
      }
    }

    const closed = closedResult.rows;
    const wins = closed.filter((t) => Number(t.pnl_usd_net) > 0).length;
    const totalPnlUsd = closed.reduce((sum, t) => sum + Number(t.pnl_usd_net || 0), 0);
    const haltRow = haltResult.rows[0] || { halted: false, reason: null, halted_ts_ms: null };

    // avg straddle (full-cycle) duration - only groups where BOTH legs are
    // closed count as a complete cycle; duration = later leg's exit minus the
    // shared entry (both legs of a group always open at the same timestamp)
    const byGroup = {};
    for (const t of closed) {
      (byGroup[t.trade_group_id] = byGroup[t.trade_group_id] || []).push(t);
    }
    const cycleDurationsMs = Object.values(byGroup)
      .filter((legs) => legs.length === 2)
      .map((legs) => Math.max(...legs.map((l) => Number(l.exit_ts_ms))) - Number(legs[0].entry_ts_ms));
    const avgStraddleDurationMs = cycleDurationsMs.length
      ? cycleDurationsMs.reduce((a, b) => a + b, 0) / cycleDurationsMs.length
      : null;

    res.status(200).json({
      open: openResult.rows,
      closed,
      events: eventsResult.rows,
      priceHistory: priceHistoryResult.rows,
      config: configSnapshot,
      walletBalances: walletBalancesResult.rows,
      halt: haltRow,
      summary: {
        openCount: openResult.rows.length,
        closedCount: closed.length,
        wins,
        winRate: closed.length ? (wins / closed.length) * 100 : null,
        totalPnlUsd,
        avgStraddleDurationMs,
        dryRun: openResult.rows[0] ? openResult.rows[0].dry_run
          : (closed[0] ? closed[0].dry_run : null),
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    await client.end().catch(() => {});
  }
};
