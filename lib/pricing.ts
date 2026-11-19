import { get, run } from "./db";
import { DEFAULT_PRICES, type Prices } from "./services";

const KEYS: Record<keyof Prices, string> = {
  basic: "price_basic", race: "price_race", repair: "price_repair", lesson: "price_lesson", skifast: "price_skifast",
};

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

export type PhotoKey = "basic" | "race" | "repair" | "lesson";
export const PHOTO_KEYS: PhotoKey[] = ["basic", "race", "repair", "lesson"];

/** Uploaded photo ids for each service (null = none yet). */
export function getServicePhotos(): Record<PhotoKey, string | null> {
  const out = { basic: null, race: null, repair: null, lesson: null } as Record<PhotoKey, string | null>;
  for (const k of PHOTO_KEYS) {
    out[k] = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", `photo_${k}`)?.value || null;
  }
  return out;
}

export function setServicePhoto(k: PhotoKey, imageId: string | null) {
  const old = getServicePhotos()[k];
  if (imageId) {
    run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", `photo_${k}`, imageId);
  } else {
    run("DELETE FROM settings WHERE key = ?", `photo_${k}`);
  }
  return old;
}
