import { all, get, run } from "./db";
import { todayISO } from "./services";

/** Small key/value settings the operator edits from the dashboard (charity notice, About page, promos). */
export function getSetting(key: string): string | null {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null) run("DELETE FROM settings WHERE key = ?", key);
  else run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

/* ---------- Charity notice ---------- */

export type Charity = { name: string; totalCents: number; asOf: string | null; url: string };

export const DEFAULT_CHARITY = { name: "South Shore Foodbank", url: "" };

export function getCharity(): Charity {
  const n = Number(getSetting("charity_total_cents"));
  return {
    name: getSetting("charity_name") || DEFAULT_CHARITY.name,
    url: getSetting("charity_url") ?? DEFAULT_CHARITY.url,
    totalCents: Number.isInteger(n) && n > 0 ? n : 0,
    asOf: getSetting("charity_as_of"),
  };
}

/* ---------- Early season promotion ---------- */

/** "Tune 3, get 1 free": in one booking, every 4th piece's tune is free when pickup is on or before the end date. */
export const EARLY_SEASON = { buy: 3, free: 1, defaultEnd: "12-15" };

export function earlySeasonEnd(): string {
  const saved = getSetting("promo_early_end");
  if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  // Default: December 15 of the current season (Jan-Jun belongs to the season that started last year)
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return `${month >= 7 ? year : year - 1}-${EARLY_SEASON.defaultEnd}`;
}

export function earlySeasonActive(date = todayISO()) {
  return date <= earlySeasonEnd();
}

/** How many pieces in a booking of `count` pieces are free under the early season promo. */
export function earlySeasonFreeCount(count: number, pickupDate: string) {
  if (!earlySeasonActive() || pickupDate > earlySeasonEnd()) return 0;
  return Math.floor(count / (EARLY_SEASON.buy + EARLY_SEASON.free)) * EARLY_SEASON.free;
}

/* ---------- About page ---------- */

export const DEFAULT_ABOUT = {
  title: "About Edge RX",
  bio:
    "Edge RX started on a basement bench with one simple idea: skiers and riders shouldn't have to give up a Saturday to get their gear tuned.\n\n" +
    "We pick up your skis or snowboard, tune them to the spec you choose, and drop them back at your door before your trip. " +
    "Every piece gets a numbered tag so nothing gets mixed up.\n\n" +
    "Edit this bio and add photos from the dashboard (Dashboard → About page).",
};

export type AboutPhoto = { id: number; image_id: string; caption: string; sort: number };

export function getAbout() {
  return {
    title: getSetting("about_title") || DEFAULT_ABOUT.title,
    bio: getSetting("about_bio") ?? DEFAULT_ABOUT.bio,
    photos: all<AboutPhoto>("SELECT * FROM about_photos ORDER BY sort, id"),
  };
}

/* ---------- Home mountain / best run ---------- */

export type Tally = { label: string; n: number };

/** All customers' home mountains (or best runs), counted case-insensitively, most popular first. */
export function mountainTally(field: "home_mountain" | "best_run", limit = 8): { rows: Tally[]; total: number } {
  const rows = all<{ label: string; n: number }>(
    `SELECT MIN(TRIM(${field})) AS label, COUNT(*) AS n FROM users
     WHERE role = 'customer' AND TRIM(${field}) != ''
     GROUP BY LOWER(TRIM(${field})) ORDER BY n DESC, label LIMIT ?`,
    limit
  );
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role = 'customer' AND TRIM(${field}) != ''`)?.n ?? 0;
  return { rows, total };
}

/** Best runs with the mountain they belong to, most recent first. */
export function recentBestRuns(limit = 6) {
  return all<{ best_run: string; home_mountain: string; first: string }>(
    `SELECT TRIM(best_run) AS best_run, TRIM(home_mountain) AS home_mountain, name AS first FROM users
     WHERE role = 'customer' AND TRIM(best_run) != '' ORDER BY id DESC LIMIT ?`,
    limit
  ).map((r) => ({ ...r, first: r.first.split(" ")[0] }));
}

export const SUGGESTION_TOPICS = ["Feedback", "Idea for a new service", "Something else"];
export const LESSON_TIMES = ["Morning (9–12)", "Afternoon (12–4)", "Evening (4–8)"];
