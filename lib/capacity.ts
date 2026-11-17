import { all, get, run } from "./db";
import { addDays } from "./services";

export const DEFAULT_DAILY_CAPACITY = 6;

/** Max pickups per day. 0 means no limit. */
export function dailyCapacity(): number {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = 'daily_capacity'");
  const n = row ? Number(row.value) : DEFAULT_DAILY_CAPACITY;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_CAPACITY;
}

export function setDailyCapacity(n: number) {
  run(
    "INSERT INTO settings (key, value) VALUES ('daily_capacity', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(Math.max(0, Math.floor(n)))
  );
}

export type BlockedDate = { date: string; reason: string };

export function blockedDates(from: string): BlockedDate[] {
  return all<BlockedDate>("SELECT date, reason FROM blocked_dates WHERE date >= ? ORDER BY date", from);
}

function pickupsOn(date: string): number {
  return (
    get<{ n: number }>("SELECT COUNT(*) n FROM orders WHERE pickup_date = ? AND status != 'cancelled'", date)?.n ?? 0
  );
}

/** Why a pickup can't happen on this date, or null if it's open. */
export function pickupUnavailable(date: string): string | null {
  const b = get<BlockedDate>("SELECT date, reason FROM blocked_dates WHERE date = ?", date);
  if (b) return b.reason ? `We're not doing pickups that day (${b.reason}).` : "We're not doing pickups that day.";
  const cap = dailyCapacity();
  if (cap > 0 && pickupsOn(date) >= cap) return "That pickup day is fully booked.";
  return null;
}

/** Dates in the next `days` days that can't take a pickup, for the booking form. */
export function unavailableDates(from: string, days = 90): Record<string, string> {
  const to = addDays(from, days);
  const out: Record<string, string> = {};
  for (const b of all<BlockedDate>("SELECT date, reason FROM blocked_dates WHERE date BETWEEN ? AND ?", from, to)) {
    out[b.date] = b.reason ? `Closed: ${b.reason}` : "Closed";
  }
  const cap = dailyCapacity();
  if (cap > 0) {
    const full = all<{ pickup_date: string }>(
      `SELECT pickup_date FROM orders WHERE status != 'cancelled' AND pickup_date BETWEEN ? AND ?
       GROUP BY pickup_date HAVING COUNT(*) >= ?`,
      from, to, cap
    );
    for (const f of full) out[f.pickup_date] ??= "Fully booked";
  }
  return out;
}
