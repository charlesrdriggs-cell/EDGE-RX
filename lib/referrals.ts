import crypto from "node:crypto";
import { get, run, all, type User } from "./db";
import { sendEmail, APP_URL, BUSINESS_NAME } from "./email";
import { sendSms } from "./sms";
import { money } from "./services";

/** What the referrer earns for each new customer whose first tune goes ahead. */
export const REFERRAL_REWARD_CENTS = 1000;
/** Most contacts a customer can invite in one go, and in one day. */
export const MAX_PER_SEND = 10;
export const MAX_PER_DAY = 30;
/** An order counts once the gear has actually been picked up (or it was paid for). */
export const QUALIFYING_STATUSES = ["picked_up", "in_progress", "ready", "returned"];
export const REF_COOKIE = "ref";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

/** US-style phone normalisation: digits only, leading country code 1 dropped. "" if not a phone. */
export function normalizePhone(s: string) {
  let d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : "";
}

function e164(phone10: string) {
  return `+1${phone10}`;
}

export function referralLink(code: string) {
  return `${APP_URL}/r/${code}`;
}

/** The customer's referral code, created the first time it's needed. */
export function referralCode(userId: number): string {
  const row = get<{ referral_code: string | null }>("SELECT referral_code FROM users WHERE id = ?", userId);
  if (row?.referral_code) return row.referral_code;
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    if (!get("SELECT id FROM users WHERE referral_code = ?", code)) {
      run("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL", code, userId);
      return get<{ referral_code: string }>("SELECT referral_code FROM users WHERE id = ?", userId)!.referral_code;
    }
  }
}

export function findReferrerByCode(code: string) {
  const c = code.trim().toUpperCase();
  if (!c) return undefined;
  return get<{ id: number; name: string; email: string; phone: string }>(
    "SELECT id, name, email, phone FROM users WHERE referral_code = ? AND role = 'customer'", c
  );
}

export function creditBalance(userId: number): number {
  return get<{ b: number }>("SELECT COALESCE(SUM(amount_cents), 0) AS b FROM credits WHERE user_id = ?", userId)!.b;
}

export function amountDue(o: { price_cents: number; credit_cents?: number | null }) {
  return Math.max(0, o.price_cents - (o.credit_cents ?? 0));
}

type Contact = { contact: string; channel: "email" | "sms"; display: string };

/** Splits free text ("a@b.com, 303-555-0100\n...") into valid email and phone contacts. */
export function parseContacts(text: string): { contacts: Contact[]; invalid: string[] } {
  const contacts: Contact[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    let c: Contact | null = null;
    if (raw.includes("@")) {
      const e = normalizeEmail(raw);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) c = { contact: e, channel: "email", display: e };
    } else {
      const p = normalizePhone(raw);
      if (p) c = { contact: p, channel: "sms", display: `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` };
    }
    if (!c) invalid.push(raw);
    else if (!seen.has(c.contact)) {
      seen.add(c.contact);
      contacts.push(c);
    }
  }
  return { contacts, invalid };
}

function isExistingCustomer(c: Contact) {
  if (c.channel === "email") return !!get("SELECT id FROM users WHERE email = ?", c.contact);
  return all<{ phone: string }>("SELECT phone FROM users WHERE phone != ''").some((u) => normalizePhone(u.phone) === c.contact);
}

export function inviteMessage(referrer: { name: string }, code: string) {
  const first = referrer.name.split(" ")[0];
  return `${first} thinks you'd like ${BUSINESS_NAME}: ski & snowboard tunes with free pickup and drop off. Book your first tune here: ${referralLink(code)}`;
}

export type InviteResult = {
  sent: string[];
  skipped: { contact: string; why: string }[];
  /** Phone invites we couldn't text automatically; the customer can send these from their own phone. */
  textYourself: { display: string; href: string }[];
};

export async function sendInvites(referrer: User, text: string): Promise<InviteResult | { error: string }> {
  const { contacts, invalid } = parseContacts(text);
  if (contacts.length === 0) {
    return { error: invalid.length ? `We couldn't read: ${invalid.join(", ")}. Enter emails or 10-digit phone numbers.` : "Enter at least one email or phone number." };
  }
  if (contacts.length > MAX_PER_SEND) return { error: `You can invite up to ${MAX_PER_SEND} people at a time.` };
  const today = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM referral_invites WHERE referrer_id = ? AND created_at > datetime('now', '-1 day')", referrer.id
  )!.n;
  if (today + contacts.length > MAX_PER_DAY) {
    return { error: `That's more invites than we can send today (limit ${MAX_PER_DAY} a day). Try again tomorrow.` };
  }

  const code = referralCode(referrer.id);
  const message = inviteMessage(referrer, code);
  const ownPhone = normalizePhone(referrer.phone);
  const res: InviteResult = { sent: [], skipped: invalid.map((c) => ({ contact: c, why: "not an email or phone number" })), textYourself: [] };

  for (const c of contacts) {
    if (c.contact === normalizeEmail(referrer.email) || c.contact === ownPhone) {
      res.skipped.push({ contact: c.display, why: "that's you" });
      continue;
    }
    if (isExistingCustomer(c)) {
      res.skipped.push({ contact: c.display, why: "already a customer" });
      continue;
    }
    if (get("SELECT id FROM referral_invites WHERE referrer_id = ? AND contact = ?", referrer.id, c.contact)) {
      res.skipped.push({ contact: c.display, why: "already invited" });
      continue;
    }
    let delivery: string;
    if (c.channel === "email") {
      delivery = await sendEmail({
        userId: null, to: c.contact, kind: "referral",
        subject: `${referrer.name.split(" ")[0]} invited you to ${BUSINESS_NAME}`,
        body: [
          "Hi there,", "",
          message, "", "Sign up with that link so your friend gets credit for sending you our way.", "", BUSINESS_NAME,
        ].join("\n"),
      });
    } else {
      delivery = await sendSms({ userId: null, to: e164(c.contact), body: message, kind: "referral-sms" });
      if (delivery !== "sent") {
        res.textYourself.push({ display: c.display, href: `sms:${e164(c.contact)}?&body=${encodeURIComponent(message)}` });
      }
    }
    run(
      "INSERT INTO referral_invites (referrer_id, contact, channel, delivery) VALUES (?, ?, ?, ?)",
      referrer.id, c.contact, c.channel, delivery
    );
    res.sent.push(c.display);
  }
  return res;
}

/**
 * Called when a new customer signs up. Links them to whoever referred them: the referral
 * code they arrived with first, otherwise the earliest invite sent to their email or phone.
 */
export function attachReferrer(newUserId: number, email: string, phone: string, code: string) {
  const p = normalizePhone(phone);
  let referrerId = findReferrerByCode(code)?.id;
  if (!referrerId) {
    referrerId = get<{ referrer_id: number }>(
      "SELECT referrer_id FROM referral_invites WHERE contact = ? OR (? != '' AND contact = ?) ORDER BY id LIMIT 1",
      normalizeEmail(email), p, p
    )?.referrer_id;
  }
  if (!referrerId || referrerId === newUserId) return;
  const referrer = get<{ phone: string }>("SELECT phone FROM users WHERE id = ?", referrerId);
  if (!referrer || (p && normalizePhone(referrer.phone) === p)) return; // same phone = same person
  run("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL", referrerId, newUserId);
}

/**
 * Gives the referrer their $10 the first time one of the referred customer's orders goes ahead
 * (picked up or paid). Runs at most once per referred customer.
 */
export async function maybeRewardReferral(orderId: number) {
  const row = get<{ user_id: number; referred_by: number | null; name: string }>(
    "SELECT o.user_id, u.referred_by, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?", orderId
  );
  if (!row?.referred_by) return;
  if (get("SELECT id FROM credits WHERE referred_user_id = ? AND reason = 'referral'", row.user_id)) return;
  const referrer = get<{ id: number; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE id = ?", row.referred_by
  );
  if (!referrer) return;
  try {
    run(
      "INSERT INTO credits (user_id, amount_cents, reason, referred_user_id, order_id, note) VALUES (?, ?, 'referral', ?, ?, ?)",
      referrer.id, REFERRAL_REWARD_CENTS, row.user_id, orderId, `Referred ${row.name}`
    );
  } catch {
    return; // unique index: already rewarded
  }
  const friend = row.name.split(" ")[0];
  await sendEmail({
    userId: referrer.id, to: referrer.email, kind: "referral-reward",
    subject: `You earned ${money(REFERRAL_REWARD_CENTS)} off your next tune`,
    body: [
      `Hi ${referrer.name.split(" ")[0]},`, "",
      `${friend} just had their first tune with us, so you've earned ${money(REFERRAL_REWARD_CENTS)} off.`,
      `Your credit balance is now ${money(creditBalance(referrer.id))}, and it comes off your next booking automatically.`, "",
      `Book a tune: ${APP_URL}/book`,
      `Invite more friends: ${APP_URL}/account#refer`, "", BUSINESS_NAME,
    ].join("\n"),
  });
}

/** Uses the customer's credit balance on a new order. Returns the amount applied. */
export function applyCreditToOrder(userId: number, orderId: number, priceCents: number) {
  const credit = Math.min(creditBalance(userId), priceCents);
  if (credit <= 0) return 0;
  run("INSERT INTO credits (user_id, amount_cents, reason, order_id) VALUES (?, ?, 'order', ?)", userId, -credit, orderId);
  run("UPDATE orders SET credit_cents = ? WHERE id = ?", credit, orderId);
  if (credit >= priceCents) run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", orderId);
  return credit;
}

/** Gives credit back when an order that used it is cancelled. Runs at most once per order. */
export function refundOrderCredit(orderId: number) {
  const o = get<{ user_id: number; credit_cents: number }>("SELECT user_id, credit_cents FROM orders WHERE id = ?", orderId);
  if (!o || !o.credit_cents) return;
  if (get("SELECT id FROM credits WHERE order_id = ? AND reason = 'refund'", orderId)) return;
  run("INSERT INTO credits (user_id, amount_cents, reason, order_id) VALUES (?, ?, 'refund', ?)", o.user_id, o.credit_cents, orderId);
}

export type ReferralStats = { invited: number; joined: number; rewarded: number; earnedCents: number };

export function referralStats(userId: number): ReferralStats {
  return get<ReferralStats>(
    `SELECT
       (SELECT COUNT(*) FROM referral_invites WHERE referrer_id = ?) AS invited,
       (SELECT COUNT(*) FROM users WHERE referred_by = ?) AS joined,
       (SELECT COUNT(*) FROM credits WHERE user_id = ? AND reason = 'referral') AS rewarded,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM credits WHERE user_id = ? AND reason = 'referral') AS earnedCents`,
    userId, userId, userId, userId
  )!;
}
