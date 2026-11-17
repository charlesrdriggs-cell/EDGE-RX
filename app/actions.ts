"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { attachReferrer, applyCreditToOrder, refundOrderCredit, maybeRewardReferral, QUALIFYING_STATUSES } from "@/lib/referrals";
import { get, run, all, type Order, type Equipment } from "@/lib/db";
import { currentUser, startSession, endSession, requireUser, requireOperator } from "@/lib/auth";
import {
  SERVICES, WAX_SPECS, BASE_BEVELS, SIDE_EDGES, STATUSES, orderPrice, money, fmtDate,
  specSummary, todayISO, type ServiceId,
} from "@/lib/services";
import { sendEmail, APP_URL, BUSINESS_NAME } from "@/lib/email";
import { sendWeeklyReminders } from "@/lib/reminders";
import { paymentsEnabled, createCheckout } from "@/lib/payments";

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
  if (!name || !email || !phone || !address) return { error: "Please fill in your name, email, phone and address." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (get("SELECT id FROM users WHERE email = ?", email)) return { error: "An account with that email already exists. Try logging in." };
  const res = run(
    "INSERT INTO users (email, password_hash, name, phone, address, reminders_opt_in, next_trip_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    email, bcrypt.hashSync(password, 10), name, phone, address,
    fd.get("reminders") ? 1 : 0, isDate(trip) ? trip : null
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
  if (!name || !phone || !address) return { error: "Name, phone and address are required." };
  run(
    "UPDATE users SET name = ?, phone = ?, address = ?, reminders_opt_in = ?, next_trip_date = ? WHERE id = ?",
    name, phone, address, fd.get("reminders") ? 1 : 0, isDate(trip) ? trip : null, u.id
  );
  revalidatePath("/account");
  return { ok: "Saved." };
}

export async function addEquipment(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const kind = str(fd, "kind") === "snowboard" ? "snowboard" : "skis";
  const description = str(fd, "description");
  if (!description) return { error: "Describe the gear (brand, model, length, color)." };
  run("INSERT INTO equipment (user_id, kind, description) VALUES (?, ?, ?)", u.id, kind, description);
  revalidatePath("/account");
  return { ok: "Gear added." };
}

export async function createOrder(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (u.role !== "customer") return { error: "Operator accounts can't place orders. Log in as a customer." };
  const service = str(fd, "service") as ServiceId;
  if (!SERVICES[service]) return { error: "Choose a service." };

  // Equipment: existing or new
  let equipmentId = Number(str(fd, "equipment_id")) || 0;
  if (equipmentId) {
    if (!get("SELECT id FROM equipment WHERE id = ? AND user_id = ?", equipmentId, u.id)) return { error: "Choose your gear." };
  } else {
    const desc = str(fd, "new_description");
    if (!desc) return { error: "Describe the skis or snowboard we're picking up." };
    const kind = str(fd, "new_kind") === "snowboard" ? "snowboard" : "skis";
    equipmentId = Number(run("INSERT INTO equipment (user_id, kind, description) VALUES (?, ?, ?)", u.id, kind, desc).lastInsertRowid);
  }

  let wax: string | null = null, bevel: string | null = null, side: string | null = null;
  if (service === "basic") {
    wax = str(fd, "wax_spec");
    if (!(WAX_SPECS as readonly string[]).includes(wax)) return { error: "Pick a wax spec." };
  } else {
    bevel = str(fd, "base_bevel");
    side = str(fd, "side_edge");
    if (!(BASE_BEVELS as readonly string[]).includes(bevel)) return { error: "Pick a base bevel between 0.5° and 0.7°." };
    if (!(SIDE_EDGES as readonly string[]).includes(side)) return { error: "Pick a side edge between 1° and 5°." };
  }
  const baseRepair = fd.get("base_repair") ? 1 : 0;

  const pickup = str(fd, "pickup_date"), due = str(fd, "due_date");
  const today = todayISO();
  if (!isDate(pickup) || !isDate(due)) return { error: "Choose a pickup date and a return date." };
  if (pickup <= today) return { error: "Pickup date must be tomorrow or later." };
  if (due <= pickup) return { error: "Return date must be after the pickup date." };

  const price = orderPrice(service, !!baseRepair);
  const res = run(
    `INSERT INTO orders (user_id, equipment_id, service, wax_spec, base_bevel, side_edge, base_repair,
       pickup_date, due_date, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    u.id, equipmentId, service, wax, bevel, side, baseRepair, pickup, due, str(fd, "notes"), price
  );
  const orderId = Number(res.lastInsertRowid);
  const credit = applyCreditToOrder(u.id, orderId, price);
  const eq = get<Equipment>("SELECT * FROM equipment WHERE id = ?", equipmentId)!;
  const o = get<Order>("SELECT * FROM orders WHERE id = ?", orderId)!;

  await sendEmail({
    userId: u.id, to: u.email, kind: "confirmation",
    subject: `Booked: ${SERVICES[service].name}, pickup ${fmtDate(pickup)}`,
    body: [
      `Hi ${u.name.split(" ")[0]},`, "",
      `You're booked! Here are the details:`, "",
      `Gear: ${eq.description} (${eq.kind})`,
      `Service: ${SERVICES[service].name}${specSummary(o) ? ` (${specSummary(o)})` : ""}`,
      `Pickup: ${fmtDate(pickup, true)} at ${u.address}`,
      `Return: ${fmtDate(due, true)}`,
      ...(credit
        ? [`Price: ${money(price)}`, `Referral credit: -${money(credit)}`, `Total due: ${money(price - credit)}`, ""]
        : [`Total: ${money(price)}`, ""]),
      `Please leave your gear somewhere easy to grab on pickup day, and reply to this email if plans change.`,
      `View your booking: ${APP_URL}/orders/${orderId}`, "", BUSINESS_NAME,
    ].join("\n"),
  });
  redirect(`/orders/${orderId}?new=1`);
}

export async function cancelOrder(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const r = run("UPDATE orders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'scheduled'", id, u.id);
  if (r.changes) refundOrderCredit(id);
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
  revalidatePath("/admin");
}

export async function sendRemindersNow(): Promise<void> {
  await requireOperator();
  const r = await sendWeeklyReminders();
  redirect(`/admin/reminders?sent=${r.sent}`);
}
