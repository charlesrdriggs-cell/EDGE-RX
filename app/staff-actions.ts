"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { get, run, all } from "@/lib/db";
import { requireOperator, requireDriver } from "@/lib/auth";
import { isOwner, type Role } from "@/lib/staff";
import { sendEmail, APP_URL, BUSINESS_NAME } from "@/lib/email";
import { maybeRewardReferral } from "@/lib/referrals";
import { syncRewards, userIdForOrder } from "@/lib/rewards";
import type { FormState } from "@/app/actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const STAFF_ROLES = ["operator", "driver"] as const;
const aRole = (r: Role) => (r === "operator" ? "an admin" : "a driver");

/* ---------- Team ---------- */

/** Adds an admin or driver by email. A new person gets an account and a link to set their password. */
export async function addStaff(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireOperator();
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!(STAFF_ROLES as readonly string[]).includes(role)) return { error: "Pick Admin or Driver." };
  if (role === "operator" && !isOwner(me)) return { error: "Only the owner account can add admins." };

  const existing = get<{ id: number; name: string; role: Role }>("SELECT id, name, role FROM users WHERE email = ?", email);
  if (existing) {
    if (existing.id === me.id || isOwner({ email })) return { error: "You can't change your own role or the owner's." };
    if (existing.role === role) return { error: `${existing.name} is already ${aRole(role)}.` };
    if (existing.role === "operator" && !isOwner(me)) return { error: "Only the owner account can change an admin." };
    run("UPDATE users SET role = ? WHERE id = ?", role, existing.id);
    await sendEmail({
      userId: existing.id, to: email, kind: "staff-added",
      subject: `You're now ${aRole(role)} at ${BUSINESS_NAME}`,
      body: [
        `Hi ${existing.name.split(" ")[0]},`, "",
        role === "operator"
          ? `You can now open the ${BUSINESS_NAME} dashboard. Log in with your usual email and password:`
          : `You're set up as a driver. Log in with your usual email and password to see your pickups and deliveries:`,
        "", `${APP_URL}/login`, "", BUSINESS_NAME,
      ].join("\n"),
    });
    revalidatePath("/admin/team");
    return { ok: `${existing.name} is now ${aRole(role)}. They'll see it next time they load a page.` };
  }

  if (!name) return { error: "There's no account with that email yet. Add their name and we'll create one." };
  const res = run(
    "INSERT INTO users (email, password_hash, name, phone, role, reminders_opt_in) VALUES (?, ?, ?, ?, ?, 0)",
    email, bcrypt.hashSync(crypto.randomBytes(24).toString("base64url"), 10), name, str(fd, "phone"), role
  );
  const userId = Number(res.lastInsertRowid);
  const token = crypto.randomBytes(32).toString("base64url");
  run(
    "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))",
    hashToken(token), userId
  );
  const link = `${APP_URL}/reset-password?token=${token}`;
  const delivery = await sendEmail({
    userId, to: email, kind: "staff-invite",
    subject: `You're invited to ${BUSINESS_NAME}`,
    body: [
      `Hi ${name.split(" ")[0]},`, "",
      `${me.name} added you as ${aRole(role)} at ${BUSINESS_NAME}. Set your password with this link (it works for 7 days):`,
      "", link, "",
      role === "driver"
        ? "After that you'll land on your route: the pickups and deliveries assigned to you."
        : "After that you'll land on the dashboard.",
      "", BUSINESS_NAME,
    ].join("\n"),
  });
  revalidatePath("/admin/team");
  if (delivery === "sent") return { ok: `Invite sent to ${email}.` };
  return { ok: `${name} is added, but the email wasn't sent (${delivery}). Send them this set-password link yourself: ${link}` };
}

/** Changes a team member's role, or sets them back to a regular customer. */
export async function setStaffRole(fd: FormData) {
  const me = await requireOperator();
  const id = Number(fd.get("id"));
  const role = str(fd, "role") as Role;
  if (!["operator", "driver", "customer"].includes(role)) return;
  const u = get<{ id: number; email: string; role: Role }>("SELECT id, email, role FROM users WHERE id = ?", id);
  if (!u || u.id === me.id || isOwner(u)) return;
  if ((u.role === "operator" || role === "operator") && !isOwner(me)) return;
  run("UPDATE users SET role = ? WHERE id = ?", role, id);
  if (role !== "driver") {
    // Their stops go back to unassigned so nothing is silently dropped
    run(
      "UPDATE orders SET pickup_driver_id = NULL WHERE pickup_driver_id = ? AND status = 'scheduled'", id
    );
    run(
      "UPDATE orders SET delivery_driver_id = NULL WHERE delivery_driver_id = ? AND status IN ('scheduled','picked_up','in_progress','ready')", id
    );
  }
  revalidatePath("/admin/team");
}

/* ---------- Dispatch ---------- */

/** Assigns (or clears) the driver for one booking's pickup or delivery. */
export async function assignDriver(fd: FormData) {
  await requireOperator();
  const groupId = Number(fd.get("group"));
  const kind = str(fd, "kind");
  const driverId = str(fd, "driver") ? Number(fd.get("driver")) : null;
  if (!groupId || (kind !== "pickup" && kind !== "delivery")) return;
  if (driverId !== null && !get("SELECT id FROM users WHERE id = ? AND role IN ('driver','operator')", driverId)) return;
  const col = kind === "pickup" ? "pickup_driver_id" : "delivery_driver_id";
  run(`UPDATE orders SET ${col} = ? WHERE (id = ? OR group_id = ?) AND status != 'cancelled'`, driverId, groupId, groupId);
  revalidatePath("/admin/dispatch");
  revalidatePath("/admin");
  revalidatePath("/driver");
}

/* ---------- Driver ---------- */

/** A driver marks their stop done: gear picked up, or gear delivered (optionally with payment collected). */
export async function completeStop(fd: FormData) {
  const me = await requireDriver();
  const groupId = Number(fd.get("group"));
  const kind = str(fd, "kind");
  if (!groupId || (kind !== "pickup" && kind !== "delivery")) return;
  const col = kind === "pickup" ? "pickup_driver_id" : "delivery_driver_id";
  const from = kind === "pickup" ? "scheduled" : "ready";
  const to = kind === "pickup" ? "picked_up" : "returned";
  // Drivers can only close their own stops; an admin can close any
  const mine = me.role === "operator" ? "1=1" : `${col} = ${Number(me.id)}`;
  const ids = all<{ id: number }>(
    `SELECT id FROM orders WHERE (id = ? OR group_id = ?) AND status = ? AND ${mine}`, groupId, groupId, from
  ).map((r) => r.id);
  if (ids.length === 0) return;
  const collected = kind === "delivery" && str(fd, "collected") === "1";
  for (const id of ids) {
    run(`UPDATE orders SET status = ?${collected ? ", payment_status = 'paid'" : ""} WHERE id = ?`, to, id);
    await maybeRewardReferral(id);
  }
  syncRewards(userIdForOrder(ids[0]));
  revalidatePath("/driver");
  revalidatePath("/admin");
}
