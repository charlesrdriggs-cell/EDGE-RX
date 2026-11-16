import { all, type User } from "./db";
import { sendEmail, BUSINESS_NAME, APP_URL } from "./email";
import { fmtDate, todayISO } from "./services";

/**
 * Weekly reminder: every opted-in customer who has no open order and hasn't had a
 * reminder in the last 6 days gets a nudge to book a pickup before their next trip.
 * Safe to call more often than weekly; the 6-day window prevents duplicates.
 */
export async function sendWeeklyReminders() {
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
      "Basic Ski Tune $50 · Race Day Tune $65 · Minor base repair +$15",
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
