"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireOperator } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { sendInvites, type InviteResult } from "@/lib/referrals";

export type InviteState = ({ error?: string } & Partial<InviteResult>) | undefined;

export async function inviteFriends(_: InviteState, fd: FormData): Promise<InviteState> {
  const u = await requireUser();
  if (u.role !== "customer") return { error: "Only customer accounts can refer friends." };
  const r = await sendInvites(u, String(fd.get("contacts") ?? ""));
  revalidatePath("/account");
  return r;
}

/** Operator: add or remove credit by hand (goodwill, corrections). */
export async function adjustCredit(fd: FormData) {
  await requireOperator();
  const userId = Number(fd.get("user_id"));
  const dollars = Number(String(fd.get("amount") ?? "").replace(/[$\s]/g, ""));
  const note = String(fd.get("note") ?? "").trim();
  if (!userId || !Number.isFinite(dollars) || dollars === 0 || Math.abs(dollars) > 1000) return;
  if (!get("SELECT id FROM users WHERE id = ? AND role = 'customer'", userId)) return;
  run(
    "INSERT INTO credits (user_id, amount_cents, reason, note) VALUES (?, ?, 'adjustment', ?)",
    userId, Math.round(dollars * 100), note
  );
  revalidatePath("/admin/referrals");
}
