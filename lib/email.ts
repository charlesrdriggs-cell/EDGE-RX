import { run } from "./db";

export const BUSINESS_NAME = process.env.BUSINESS_NAME || "Edge & Wax Ski Tuning";
export const APP_URL = process.env.APP_URL || "http://localhost:3000";

type Email = { userId: number | null; to: string; subject: string; body: string; kind: string };

/**
 * Sends an email through Resend when RESEND_API_KEY is set. Otherwise the message is
 * only recorded in the outbox (visible to the operator at /admin/reminders), so the
 * whole app works before an email provider is chosen.
 */
export async function sendEmail(e: Email) {
  let delivery = "outbox-only";
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || `${BUSINESS_NAME} <onboarding@resend.dev>`,
          to: [e.to],
          subject: e.subject,
          text: e.body,
        }),
      });
      delivery = res.ok ? "sent" : `failed (${res.status})`;
    } catch (err) {
      delivery = `failed (${(err as Error).message})`;
    }
  } else {
    console.log(`[email:outbox] to=${e.to} subject="${e.subject}"`);
  }
  run(
    "INSERT INTO emails (user_id, to_email, subject, body, kind, delivery) VALUES (?, ?, ?, ?, ?, ?)",
    e.userId,
    e.to,
    e.subject,
    e.body,
    e.kind,
    delivery
  );
  return delivery;
}
