const BOTS = {
  ada: { label: "ADA", envVar: "DATABASE_URL_ADA", legacyEnvVar: "DATABASE_URL" },
  zec: { label: "ZEC", envVar: "DATABASE_URL_ZEC" },
  night: { label: "NIGHT", envVar: "DATABASE_URL_NIGHT" },
};
const DEFAULT_BOT = "ada";

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

/** `bot` is untrusted request input - only ever used to index into the fixed
 * BOTS map above (never interpolated into a connection string or query), so
 * there's no injection surface here regardless of what the caller passes. */
function resolveConnectionString(botParam) {
  const key = (botParam || DEFAULT_BOT).toLowerCase();
  const meta = BOTS[key];
  if (!meta) {
    throw new Error(`Neznamy bot "${botParam}" - platne hodnoty: ${Object.keys(BOTS).join(", ")}`);
  }
  // ADA falls back to the original single-bot DATABASE_URL env var so
  // existing Vercel config keeps working without a rename - ZEC/NIGHT
  // require their own explicit DATABASE_URL_ZEC / DATABASE_URL_NIGHT once
  // those Railway Postgres instances exist.
  return process.env[meta.envVar] || (meta.legacyEnvVar ? process.env[meta.legacyEnvVar] : undefined);
}

module.exports = { BOTS, DEFAULT_BOT, resolveConnectionString, timingSafeEqual };
