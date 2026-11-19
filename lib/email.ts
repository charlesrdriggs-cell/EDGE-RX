import { run } from "./db";

/** Railway and .env files sometimes keep the quotes around a value; drop them. */
function env(name: string) {
  const t = (process.env[name] ?? "").trim();
  return t.length >= 2 && /^(["']).*\1$/.test(t) ? t.slice(1, -1).trim() : t;
}

export const BUSINESS_NAME = env("BUSINESS_NAME") || "Edge RX";
export const APP_URL = env("APP_URL") || "http://localhost:3000";

export const emailProviderOn = () => Boolean(env("RESEND_API_KEY"));
export const emailFrom = () => env("EMAIL_FROM") || `${BUSINESS_NAME} <onboarding@resend.dev>`;

type Email = { userId: number | null; to: string; subject: string; body: string; kind: string };

/**
 * Sends an email through Resend when RESEND_API_KEY is set. Otherwise the message is
 * only recorded in the outbox (visible to the operator at /admin/reminders), so the
 * whole app works before an email provider is chosen.
 * Returns "sent", "outbox-only", or "failed (...)" with Resend's reason.
 */
export async function sendEmail(e: Email) {
  let delivery = "outbox-only";
  const key = env("RESEND_API_KEY");
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom(), to: [e.to], subject: e.subject, text: e.body }),
      });
      if (res.ok) {
        delivery = "sent";
      } else {
        let reason = "";
        try {
          const j = (await res.json()) as { message?: string };
          reason = j.message ? `: ${j.message}` : "";
        } catch {}
        delivery = `failed (${res.status}${reason})`.slice(0, 300);
        console.error(`[email] Resend rejected email to ${e.to}: ${delivery}`);
      }
    } catch (err) {
      delivery = `failed (${(err as Error).message})`;
      console.error(`[email] Could not reach Resend: ${delivery}`);
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
