import { all, run, ORDER_ROW_SQL, type OrderRow, type User } from "./db";
import { sendEmail, BUSINESS_NAME, APP_URL } from "./email";
import { fmtDate, todayISO, addDays, money, SERVICES } from "./services";
import { getPrices } from "./pricing";

/**
 * Weekly reminder: every opted-in customer who has no open order and hasn't had a
 * reminder in the last 6 days gets a nudge to book a pickup before their next trip.
 * Safe to call more often than weekly; the 6-day window prevents duplicates.
 */
export async function sendWeeklyReminders() {
  const prices = getPrices();
  const today = todayISO();
  const users = all<User>(
    `SELECT u.* FROM users u
     WHERE u.role = 'customer' AND u.reminders_opt_in = 1
       AND NOT EXISTS (
         SELECT 1 FROM orders o WHERE o.user_id = u.id
           AND o.status IN ('scheduled','picked_up','in_progress','ready'))
       AND NOT EXISTS (
         SELECT 1 FROM emails m WHERE m.user_id = u.id AND m.kind = 'reminder'
           AND m.sent_at > datetime('now', '-6 days'))`
  );

  let sent = 0;
  for (const u of users) {
    const first = u.name.split(" ")[0] || u.name;
    const trip = u.next_trip_date && u.next_trip_date >= today ? u.next_trip_date : null;
    const subject = trip
      ? `Your trip on ${fmtDate(trip)} is coming up. Time for a tune?`
      : "Heading to the mountains soon? Book your ski tune";
    const body = [
      `Hi ${first},`,
      "",
      trip
        ? `You told us you're skiing on ${fmtDate(trip, true)}. Book a pickup a few days before and your gear will be sharp and waxed when you leave.`
        : "Got a trip coming up? Schedule a pickup and we'll have your skis or board sharpened, waxed and back at your door before you go.",
      "",
      `${SERVICES.basic.name} ${money(prices.basic)} · ${SERVICES.race.name} ${money(prices.race)} · Minor base repair +${money(prices.repair)}`,
      "Pickup and drop off included.",
      "",
      `Book a pickup: ${APP_URL}/book`,
      "",
      `${BUSINESS_NAME}`,
      `Don't want these? Turn off reminders at ${APP_URL}/account`,
    ].join("\n");
    await sendEmail({ userId: u.id, to: u.email, subject, body, kind: "reminder" });
    sent++;
  }
  return { sent, checked: users.length };
}

/**
 * Day-before pickup reminder: one email per customer for every booking whose pickup is
 * tomorrow (business time zone). Goes to everyone with a booking, opted in to weekly
 * reminders or not, since it's about their own order. Each order is only reminded once.
 */
export async function sendPickupReminders() {
  const tomorrow = addDays(todayISO(), 1);
  const rows = all<OrderRow>(
    `${ORDER_ROW_SQL} WHERE o.status = 'scheduled' AND o.pickup_date = ? AND o.pickup_reminded_at IS NULL ORDER BY o.user_id, o.id`,
    tomorrow
  );
  const byUser = new Map<number, OrderRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  let sent = 0;
  for (const [userId, orders] of byUser) {
    const o = orders[0];
    const first = o.customer_name.split(" ")[0] || o.customer_name;
    const spot = o.customer_pickup_spot ? ` (${o.customer_pickup_spot})` : "";
    const lines = orders.map((x) => `• ${x.owner_name ? `${x.owner_name}'s ` : ""}${x.description} (${x.kind}): ${SERVICES[x.service]?.name ?? x.service}`);
    const dues = [...new Set(orders.map((x) => x.due_date))].sort();
    const body = [
      `Hi ${first},`,
      "",
      `Reminder: we're picking up your gear tomorrow, ${fmtDate(tomorrow, true)}.`,
      "",
      ...lines,
      "",
      `Please leave it out at ${o.customer_address}${spot}, somewhere we can grab it without anyone home.`,
      `It comes back ${dues.map((d) => fmtDate(d, true)).join(" / ")}.`,
      "",
      `Plans changed? View or cancel your booking: ${APP_URL}/orders/${o.group_id ?? o.id}`,
      "",
      BUSINESS_NAME,
    ].join("\n");
    await sendEmail({
      userId,
      to: o.customer_email,
      kind: "pickup-reminder",
      subject: `Pickup tomorrow (${fmtDate(tomorrow)}): please leave your gear out`,
      body,
    });
    for (const x of orders) run("UPDATE orders SET pickup_reminded_at = datetime('now') WHERE id = ?", x.id);
    sent++;
  }
  return { sent, date: tomorrow };
}
