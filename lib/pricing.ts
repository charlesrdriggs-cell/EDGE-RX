import { get, run } from "./db";
import { DEFAULT_PRICES, type Prices } from "./services";

const KEYS: Record<keyof Prices, string> = { basic: "price_basic", race: "price_race", repair: "price_repair" };

/** Current prices: the operator's saved values, or the defaults in lib/services.ts. */
export function getPrices(): Prices {
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(KEYS) as (keyof Prices)[]) {
    const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", KEYS[k]);
    const n = row ? Number(row.value) : NaN;
    if (Number.isInteger(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function setPrices(p: Prices) {
  for (const k of Object.keys(KEYS) as (keyof Prices)[]) {
    run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      KEYS[k], String(p[k])
    );
  }
}
