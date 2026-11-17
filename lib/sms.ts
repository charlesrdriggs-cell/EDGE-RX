import { run } from "./db";

export const smsEnabled = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

/**
 * Sends a text through Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set.
 * Otherwise the message is only recorded in the outbox (shown at /admin/reminders), and the
 * customer is offered a one-tap link to send it from their own phone instead.
 */
export async function sendSms(m: { userId: number | null; to: string; body: string; kind: string }) {
  let delivery = "outbox-only";
  if (smsEnabled()) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: m.to, From: process.env.TWILIO_FROM!, Body: m.body }),
      });
      delivery = res.ok ? "sent" : `failed (${res.status})`;
    } catch (err) {
      delivery = `failed (${(err as Error).message})`;
    }
  } else {
    console.log(`[sms:outbox] to=${m.to}`);
  }
  run(
    "INSERT INTO emails (user_id, to_email, subject, body, kind, delivery) VALUES (?, ?, ?, ?, ?, ?)",
    m.userId, m.to, "(text message)", m.body, m.kind, delivery
  );
  return delivery;
}
