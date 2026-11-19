"use server";

import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { setSetting } from "@/lib/site";
import type { FormState } from "@/app/actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Payment instructions printed on every invoice: Venmo handle, check payee, etc. */
export async function savePaymentSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const venmo = str(fd, "pay_venmo").replace(/^@+/, "").replace(/^https?:\/\/(www\.)?venmo\.com\/(u\/)?/i, "");
  if (venmo && !/^[A-Za-z0-9_-]{1,30}$/.test(venmo)) {
    return { error: "Enter just the Venmo username, e.g. @Edge-RX (letters, numbers, - and _ only)." };
  }
  setSetting("pay_venmo", venmo || null);
  setSetting("pay_check_payee", str(fd, "pay_check_payee").slice(0, 80) || null);
  setSetting("pay_check_mail", str(fd, "pay_check_mail").slice(0, 160) || null);
  setSetting("pay_contact", str(fd, "pay_contact").slice(0, 80) || null);
  setSetting("pay_note", str(fd, "pay_note").slice(0, 300) || null);
  revalidatePath("/admin/invoices");
  return { ok: "Saved. Every invoice now shows these payment details." };
}
