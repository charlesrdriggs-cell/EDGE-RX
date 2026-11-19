import { get, run } from "./db";
import { ensureShop } from "./shop";

/**
 * Rewards: customers earn $25 credit for every $250 they spend. Credit goes into the same
 * ledger as referral credit (`credits`, reason 'reward') and comes off the next booking.
 *
 * Spend counts what the customer actually owes (after credit) on:
 *  - tune orders once the gear has been picked up, or they're paid
 *  - retail orders once delivered or paid
 *  - Learn to Tune sessions once done or paid
 * Cancelled anything never counts.
 */
export const REWARD_EVERY_CENTS = 25000;
export const REWARD_CENTS = 2500;

export function lifetimeSpend(userId: number): number {
  ensureShop();
  return (
    get<{ s: number }>(
      `SELECT
        COALESCE((SELECT SUM(MAX(0, price_cents - credit_cents)) FROM orders WHERE user_id = ? AND status != 'cancelled'
           AND (status IN ('picked_up','in_progress','ready','returned') OR payment_status = 'paid')), 0)
      + COALESCE((SELECT SUM(total_cents) FROM shop_orders WHERE user_id = ? AND status != 'cancelled'
           AND (status = 'delivered' OR payment_status = 'paid')), 0)
      + COALESCE((SELECT SUM(price_cents) FROM lessons WHERE user_id = ? AND status != 'cancelled'
           AND (status = 'done' OR payment_status = 'paid')), 0) AS s`,
      userId, userId, userId
    )?.s ?? 0
  );
}

export function rewardsEarned(userId: number) {
  return get<{ n: number }>("SELECT COUNT(*) n FROM credits WHERE user_id = ? AND reason = 'reward'", userId)?.n ?? 0;
}

/** Issues any $25 rewards the customer has earned but not yet received. Safe to call any time. */
export function syncRewards(userId: number | null | undefined) {
  if (!userId) return 0;
  try {
    const due = Math.floor(lifetimeSpend(userId) / REWARD_EVERY_CENTS);
    const have = rewardsEarned(userId);
    for (let i = have; i < due; i++) {
      run(
        "INSERT INTO credits (user_id, amount_cents, reason, note) VALUES (?, ?, 'reward', ?)",
        userId, REWARD_CENTS, `Rewards: $${((i + 1) * REWARD_EVERY_CENTS) / 100} spent`
      );
    }
    return Math.max(0, due - have);
  } catch {
    return 0;
  }
}

export function rewardsProgress(userId: number) {
  const spend = lifetimeSpend(userId);
  const into = spend % REWARD_EVERY_CENTS;
  return {
    spend,
    earned: rewardsEarned(userId),
    into,
    toGo: REWARD_EVERY_CENTS - into,
    pct: Math.round((into / REWARD_EVERY_CENTS) * 100),
  };
}

export const userIdForOrder = (orderId: number) => get<{ user_id: number }>("SELECT user_id FROM orders WHERE id = ?", orderId)?.user_id;
export const userIdForShopOrder = (id: number) => get<{ user_id: number }>("SELECT user_id FROM shop_orders WHERE id = ?", id)?.user_id;
