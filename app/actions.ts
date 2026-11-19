"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { attachReferrer, applyCreditToOrder, refundOrderCredit, maybeRewardReferral, QUALIFYING_STATUSES } from "@/lib/referrals";
import { get, run, all, type Order, type Equipment } from "@/lib/db";
import { currentUser, startSession, endSession, requireUser, requireOperator } from "@/lib/auth";
import {
  SERVICES, WAX_SPECS, BASE_BEVELS, SIDE_EDGES, STATUSES, orderPrice, money, fmtDate,
  specSummary, todayISO, addDays, NOTICE_DAYS, MAX_PIECES, type ServiceId,
} from "@/lib/services";
import { syncRewards, userIdForOrder } from "@/lib/rewards";
import { earlySeasonFreeCount } from "@/lib/site";
import { sendEmail, APP_URL, BUSINESS_NAME, emailProviderOn, emailFrom } from "@/lib/email";
import { sendWeeklyReminders } from "@/lib/reminders";
import { paymentsEnabled, createCheckout } from "@/lib/payments";
import { pickupUnavailable, setDailyCapacity } from "@/lib/capacity";
import { getPrices, setPrices } from "@/lib/pricing";
import { cartFromForm, placeShopOrder, shopItems, itemsSummary, cancelExtrasForTune } from "@/lib/shop";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "");

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const phone = str(fd, "phone");
  const address = str(fd, "address");
  const password = String(fd.get("password") ?? "");
  const trip = str(fd, "next_trip_date");
  const spot = str(fd, "pickup_spot").slice(0, 200);
  if (!name || !email || !phone || !address) return { error: "Please fill in your name, email, phone and address." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (get("SELECT id FROM users WHERE email = ?", email)) return { error: "An account with that email already exists. Try logging in." };
  const res = run(
    "INSERT INTO users (email, password_hash, name, phone, address, reminders_opt_in, next_trip_date, pickup_spot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    email, bcrypt.hashSync(password, 10), name, phone, address,
    fd.get("reminders") ? 1 : 0, isDate(trip) ? trip : null, spot
  );
  attachReferrer(Number(res.lastInsertRowid), email, phone, str(fd, "ref"));
  await startSession(Number(res.lastInsertRowid));
  redirect(safeNext(str(fd, "next")) || "/book");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const u = get<{ id: number; password_hash: string; role: string }>(
    "SELECT id, password_hash, role FROM users WHERE email = ?", email
  );
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return { error: "Wrong email or password." };
  await startSession(u.id);
  redirect(safeNext(str(fd, "next")) || (u.role === "operator" ? "/admin" : "/account"));
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const name = str(fd, "name"), phone = str(fd, "phone"), address = str(fd, "address");
  const trip = str(fd, "next_trip_date");
  const spot = str(fd, "pickup_spot").slice(0, 200);
  const mountain = str(fd, "home_mountain").slice(0, 80), bestRun = str(fd, "best_run").slice(0, 80);
  if (!name || !phone || !address) return { error: "Name, phone and address are required." };
  if (!spot) return { error: "Tell us where you'll leave your gear for pickup (front porch, side yard, garage…)." };
  run(
    `UPDATE users SET name = ?, phone = ?, address = ?, reminders_opt_in = ?, next_trip_date = ?,
       pickup_spot = ?, home_mountain = ?, best_run = ? WHERE id = ?`,
    name, phone, address, fd.get("reminders") ? 1 : 0, isDate(trip) ? trip : null, spot, mountain, bestRun, u.id
  );
  revalidatePath("/account");
  revalidatePath("/");
  return { ok: "Saved." };
}

export async function addEquipment(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const kind = str(fd, "kind") === "snowboard" ? "snowboard" : "skis";
  const description = str(fd, "description");
  const owner = str(fd, "owner_name").slice(0, 60);
  if (!owner) return { error: "Whose gear is this? Add the skier or rider's name." };
  if (!description) return { error: "Describe the gear (brand, model, length, color)." };
  run("INSERT INTO equipment (user_id, kind, description, owner_name) VALUES (?, ?, ?, ?)", u.id, kind, description, owner);
  revalidatePath("/account");
  return { ok: "Gear added." };
}

export async function updateEquipment(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  if (fd.get("remove") === "1") {
    // Gear on past orders stays (orders point at it); only unused gear is deleted
    const used = get("SELECT id FROM orders WHERE equipment_id = ?", id);
    if (!used) run("DELETE FROM equipment WHERE id = ? AND user_id = ?", id, u.id);
  } else {
    const owner = str(fd, "owner_name").slice(0, 60), description = str(fd, "description");
    if (description) {
      run("UPDATE equipment SET owner_name = ?, description = ? WHERE id = ? AND user_id = ?", owner, description, id, u.id);
    }
  }
  revalidatePath("/account");
}

type Piece = {
  equipmentId: number;
  service: ServiceId;
  wax: string | null;
  bevel: string | null;
  side: string | null;
  repair: 0 | 1;
  racerId: number | null;
  price: number;
  serviceCents: number;
  promo: string;
};

export async function createOrder(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (u.role !== "customer") return { error: "Operator accounts can't place orders. Log in as a customer." };
  const count = Math.min(MAX_PIECES, Math.max(1, Number(str(fd, "pieces")) || 1));
  const prices = getPrices();

  // Validate every piece before writing anything
  const pieces: (Omit<Piece, "equipmentId"> & { equipmentId: number; newGear?: { kind: string; description: string; owner: string } })[] = [];
  const usedGear = new Set<number>();
  for (let i = 0; i < count; i++) {
    const f = (k: string) => str(fd, `p${i}_${k}`);
    const label = count > 1 ? `Piece ${i + 1}: ` : "";
    const service = f("service") as ServiceId;
    if (!SERVICES[service]) return { error: `${label}Choose a service.` };

    let equipmentId = Number(f("equipment_id")) || 0;
    let newGear: { kind: string; description: string; owner: string } | undefined;
    if (equipmentId) {
      if (!get("SELECT id FROM equipment WHERE id = ? AND user_id = ?", equipmentId, u.id)) return { error: `${label}Choose your gear.` };
      if (usedGear.has(equipmentId)) return { error: `${label}That gear is already in this booking. Pick a different piece.` };
      usedGear.add(equipmentId);
    } else {
      const description = f("new_description");
      const owner = f("new_owner").slice(0, 60);
      if (!owner) return { error: `${label}Whose gear is this? Add the skier or rider's name.` };
      if (!description) return { error: `${label}Describe the skis or snowboard we're picking up.` };
      newGear = { kind: f("new_kind") === "snowboard" ? "snowboard" : "skis", description, owner };
    }

    let wax: string | null = null, bevel: string | null = null, side: string | null = null, racerId: number | null = null;
    if (service === "basic") {
      wax = f("wax_spec");
      if (!(WAX_SPECS as readonly string[]).includes(wax)) return { error: `${label}Pick a wax spec.` };
    } else {
      bevel = f("base_bevel");
      side = f("side_edge");
      if (!(BASE_BEVELS as readonly string[]).includes(bevel)) return { error: `${label}Pick a base bevel between 0.5° and 0.7°.` };
      if (!(SIDE_EDGES as readonly string[]).includes(side)) return { error: `${label}Pick a side edge between 1° and 5°.` };
      racerId = Number(f("racer_id")) || null;
      if (racerId && !get("SELECT id FROM racers WHERE id = ? AND user_id = ?", racerId, u.id)) return { error: `${label}Choose one of your #SKIFAST racers.` };
    }
    const repair: 0 | 1 = fd.get(`p${i}_base_repair`) ? 1 : 0;
    const serviceCents = service === "race" && racerId ? prices.skifast : prices[service];
    pieces.push({
      equipmentId, newGear, service, wax, bevel, side, repair, racerId, serviceCents,
      price: orderPrice(service, !!repair, prices, !!racerId), promo: racerId ? "skifast" : "",
    });
  }

  const pickup = str(fd, "pickup_date"), due = str(fd, "due_date");
  const today = todayISO();
  if (!isDate(pickup) || !isDate(due)) return { error: "Choose a pickup date and a return date." };
  if (pickup < addDays(today, NOTICE_DAYS)) return { error: `We need 48 hours' notice for pickups. The earliest pickup is ${fmtDate(addDays(today, NOTICE_DAYS))}.` };
  if (due <= pickup) return { error: "Return date must be after the pickup date." };
  const unavailable = pickupUnavailable(pickup);
  if (unavailable) return { error: `${unavailable} Please choose another pickup date.` };

  // Early season: tune 3, get 1 free. The cheapest tunes in the booking are the free ones (base repair is still charged).
  const free = earlySeasonFreeCount(pieces.length, pickup);
  if (free) {
    [...pieces].sort((a, b) => a.serviceCents - b.serviceCents).slice(0, free).forEach((p) => {
      p.price = p.repair ? prices.repair : 0;
      p.promo = "early-season";
    });
  }

  const notes = str(fd, "notes");
  const ids: number[] = [];
  for (const p of pieces) {
    if (p.newGear) {
      p.equipmentId = Number(run(
        "INSERT INTO equipment (user_id, kind, description, owner_name) VALUES (?, ?, ?, ?)",
        u.id, p.newGear.kind, p.newGear.description, p.newGear.owner
      ).lastInsertRowid);
    }
    const res = run(
      `INSERT INTO orders (user_id, equipment_id, service, wax_spec, base_bevel, side_edge, base_repair,
         pickup_date, due_date, notes, price_cents, service_cents, repair_cents, group_id, racer_id, promo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      u.id, p.equipmentId, p.service, p.wax, p.bevel, p.side, p.repair, pickup, due, notes, p.price,
      p.serviceCents, p.repair ? prices.repair : null, ids[0] ?? null, p.racerId, p.promo
    );
    ids.push(Number(res.lastInsertRowid));
  }
  if (ids.length > 1) run(`UPDATE orders SET group_id = ? WHERE id = ?`, ids[0], ids[0]);
  // A free (early season) piece with nothing owed is settled already
  for (const id of ids) run("UPDATE orders SET payment_status = 'paid' WHERE id = ? AND price_cents = 0", id);
  const orderId = ids[0];

  // Optional retail extras (warmers, goggle cleaning...) ride back with the tuned gear.
  const cart = cartFromForm(fd);
  let extras: { text: string; cents: number } | null = null;
  if (cart.size) {
    const r = placeShopOrder({ userId: u.id, cart, tuneOrderId: orderId, deliverDate: due, notes: "" });
    if ("error" in r) {
      for (const id of ids) run("DELETE FROM orders WHERE id = ?", id);
      for (const p of pieces) if (p.newGear) run("DELETE FROM equipment WHERE id = ?", p.equipmentId);
      return { error: r.error };
    }
    const items = shopItems(r.id);
    extras = { text: itemsSummary(items), cents: items.reduce((s, i) => s + i.unit_cents * i.qty, 0) };
  }

  let credit = 0;
  for (const id of ids) {
    const o = get<{ price_cents: number }>("SELECT price_cents FROM orders WHERE id = ?", id)!;
    credit += applyCreditToOrder(u.id, id, o.price_cents);
  }
  const total = pieces.reduce((s, p) => s + p.price, 0);

  const lines = ids.map((id, i) => {
    const o = get<Order & { description: string; kind: string; owner_name: string; racer_name: string | null }>(
      `SELECT o.*, e.description, e.kind, e.owner_name, r.name AS racer_name FROM orders o
       JOIN equipment e ON e.id = o.equipment_id LEFT JOIN racers r ON r.id = o.racer_id WHERE o.id = ?`, id
    )!;
    const who = o.owner_name ? `${o.owner_name}'s ` : "";
    const promo = o.promo === "early-season" ? " (FREE: early season tune 3 get 1)" : "";
    return `${ids.length > 1 ? `${i + 1} of ${ids.length}. ` : ""}${who}${o.description} (${o.kind}): ${SERVICES[o.service].name}` +
      `${specSummary(o) ? `, ${specSummary(o)}` : ""} · ${money(o.price_cents)}${promo}`;
  });
  const n = ids.length;
  const pickupSpot = u.pickup_spot ? ` (${u.pickup_spot})` : "";

  await sendEmail({
    userId: u.id, to: u.email, kind: "confirmation",
    subject: `Booked: ${n > 1 ? `${n} pieces` : SERVICES[pieces[0].service].name}, pickup ${fmtDate(pickup)}`,
    body: [
      `Hi ${u.name.split(" ")[0]},`, "",
      `You're booked! Here are the details:`, "",
      ...lines, "",
      `Pickup: ${fmtDate(pickup, true)} at ${u.address}${pickupSpot}`,
      `Return: ${fmtDate(due, true)}`,
      ...(extras ? [`Extras (back with your gear): ${extras.text}, ${money(extras.cents)}`] : []),
      ...(credit
        ? [`Tune${n > 1 ? "s" : ""}: ${money(total)}`, `Credit: -${money(credit)}`, `Total due: ${money(total - credit + (extras?.cents ?? 0))}`, ""]
        : [`Total: ${money(total + (extras?.cents ?? 0))}`, ""]),
      `Please leave your gear in an accessible place on pickup day${pickupSpot}, where we can grab it without anyone home. Reply to this email if plans change.`,
      `View your booking: ${APP_URL}/orders/${orderId}`, "", BUSINESS_NAME,
    ].join("\n"),
  });
  redirect(`/orders/${orderId}?new=1`);
}

export async function cancelOrder(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const o = get<{ id: number; group_id: number | null }>("SELECT id, group_id FROM orders WHERE id = ? AND user_id = ?", id, u.id);
  if (!o) return;
  // "all" cancels every piece in the same pickup; otherwise just this one
  const ids = fd.get("all") === "1"
    ? all<{ id: number }>("SELECT id FROM orders WHERE (id = ? OR group_id = ?) AND user_id = ?", o.group_id ?? o.id, o.group_id ?? o.id, u.id).map((r) => r.id)
    : [id];
  for (const x of ids) {
    const r = run("UPDATE orders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'scheduled'", x, u.id);
    if (r.changes) {
      refundOrderCredit(x);
      cancelExtrasForTune(x);
    }
  }
  revalidatePath(`/orders/${id}`);
}

export async function payOrder(fd: FormData) {
  const u = await requireUser();
  const o = get<Order>("SELECT * FROM orders WHERE id = ? AND user_id = ?", Number(fd.get("id")), u.id);
  if (!o || o.payment_status === "paid" || !paymentsEnabled()) redirect(`/orders/${o?.id ?? ""}`);
  const session = await createCheckout(o, u.email);
  run("UPDATE orders SET stripe_session_id = ? WHERE id = ?", session.id, o.id);
  redirect(session.url);
}

/* ---------- Operator ---------- */

export async function setStatus(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const status = str(fd, "status");
  if (!(STATUSES as readonly string[]).includes(status)) return;
  run("UPDATE orders SET status = ? WHERE id = ?", status, id);
  if (status === "cancelled") refundOrderCredit(id);
  if (QUALIFYING_STATUSES.includes(status)) await maybeRewardReferral(id);
  syncRewards(userIdForOrder(id));
  if (status === "ready") {
    const o = get<Order & { email: string; name: string; address: string }>(
      "SELECT o.*, u.email, u.name, u.address FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?", id
    );
    if (o) {
      await sendEmail({
        userId: o.user_id, to: o.email, kind: "ready",
        subject: `Your gear is tuned and on its way ${fmtDate(o.due_date)}`,
        body: `Hi ${o.name.split(" ")[0]},\n\nYour ${SERVICES[o.service].name} is done. We'll drop your gear off at ${o.address} on ${fmtDate(o.due_date, true)}.\n\nHave a great trip!\n${BUSINESS_NAME}`,
      });
    }
  }
  revalidatePath("/admin");
}

export async function setPaid(fd: FormData) {
  await requireOperator();
  const paid = str(fd, "paid") === "1" ? "paid" : "unpaid";
  run("UPDATE orders SET payment_status = ? WHERE id = ?", paid, Number(fd.get("id")));
  if (paid === "paid") await maybeRewardReferral(Number(fd.get("id")));
  syncRewards(userIdForOrder(Number(fd.get("id"))));
  revalidatePath("/admin");
}

export async function sendRemindersNow(): Promise<void> {
  await requireOperator();
  const r = await sendWeeklyReminders();
  redirect(`/admin/reminders?sent=${r.sent}`);
}

export async function sendTestEmail(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireOperator();
  const to = str(fd, "to") || me.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid email address." };
  const delivery = await sendEmail({
    userId: null,
    to,
    kind: "test",
    subject: `Test email from ${BUSINESS_NAME}`,
    body: `This is a test from ${APP_URL}.\n\nIf you're reading this, email sending works. It was sent from ${emailFrom()}.`,
  });
  revalidatePath("/admin/reminders");
  if (delivery === "sent") return { ok: `Sent to ${to} from ${emailFrom()}. Check the inbox (and spam) in a minute.` };
  if (delivery === "outbox-only") return { error: "RESEND_API_KEY isn't set, so the test was only saved below, not sent." };
  return { error: `Resend refused it: ${delivery}` };
}

/* ---------- Password reset ---------- */

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const u = get<{ id: number; name: string; email: string }>("SELECT id, name, email FROM users WHERE email = ?", email);
  if (u) {
    const token = crypto.randomBytes(32).toString("base64url");
    run("DELETE FROM password_resets WHERE user_id = ?", u.id);
    run(
      "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))",
      hashToken(token), u.id
    );
    await sendEmail({
      userId: u.id, to: u.email, kind: "password-reset",
      subject: `Reset your ${BUSINESS_NAME} password`,
      body: [
        `Hi ${u.name.split(" ")[0]},`, "",
        "Someone asked to reset the password for your account. If that was you, use this link within 1 hour:", "",
        `${APP_URL}/reset-password?token=${token}`, "",
        "If you didn't ask for this, you can ignore this email; your password won't change.", "", BUSINESS_NAME,
      ].join("\n"),
    });
  }
  // Same answer either way so the form can't be used to discover who has an account
  return { ok: "If that email has an account, a reset link is on its way. Check your inbox." };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const row = get<{ user_id: number }>(
    "SELECT user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')",
    hashToken(token)
  );
  if (!row) return { error: "This reset link is invalid or has expired. Request a new one." };
  run("UPDATE users SET password_hash = ? WHERE id = ?", bcrypt.hashSync(password, 10), row.user_id);
  run("UPDATE password_resets SET used = 1 WHERE user_id = ?", row.user_id);
  await startSession(row.user_id);
  const role = get<{ role: string }>("SELECT role FROM users WHERE id = ?", row.user_id)?.role;
  redirect(role === "operator" ? "/admin" : "/account");
}

/* ---------- Pickup capacity ---------- */

export async function saveCapacity(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const n = Number(str(fd, "daily_capacity"));
  if (!Number.isInteger(n) || n < 0 || n > 500) return { error: "Enter a whole number (0 means no limit)." };
  setDailyCapacity(n);
  revalidatePath("/admin/schedule");
  return { ok: n === 0 ? "Saved. No daily limit." : `Saved. Up to ${n} pickups per day.` };
}

export async function addBlockedDate(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const from = str(fd, "from"), to = str(fd, "to") || from;
  if (!isDate(from) || !isDate(to) || to < from) return { error: "Pick a start date (and an end date on or after it)." };
  const reason = str(fd, "reason");
  let d = from, n = 0;
  while (d <= to && n < 120) {
    run("INSERT INTO blocked_dates (date, reason) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason", d, reason);
    const [y, m, day] = d.split("-").map(Number);
    d = new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
    n++;
  }
  revalidatePath("/admin/schedule");
  return { ok: `Blocked ${n} day${n === 1 ? "" : "s"}.` };
}

export async function removeBlockedDate(fd: FormData) {
  await requireOperator();
  run("DELETE FROM blocked_dates WHERE date = ?", str(fd, "date"));
  revalidatePath("/admin/schedule");
}

/* ---------- Tune prices ---------- */

export async function savePrices(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const parse = (k: string) => {
    const v = str(fd, k).replace(/^\$/, "");
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(v)) return NaN;
    return Math.round(Number(v) * 100);
  };
  const p = { basic: parse("basic"), race: parse("race"), repair: parse("repair"), lesson: parse("lesson"), skifast: parse("skifast") };
  if (Object.values(p).some((n) => !Number.isFinite(n))) return { error: "Enter each price as dollars, e.g. 55 or 54.99." };
  setPrices(p);
  revalidatePath("/", "layout");
  return { ok: `Saved. New bookings use these prices; existing bookings keep the price they were booked at.` };
}
