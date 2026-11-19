"use server";

import { redirect } from "next/navigation";
import { syncRewards, userIdForShopOrder } from "@/lib/rewards";
import { revalidatePath } from "next/cache";
import { get, run, tagCode } from "@/lib/db";
import { requireUser, requireOperator } from "@/lib/auth";
import { fmtDate, money } from "@/lib/services";
import { sendEmail, APP_URL, BUSINESS_NAME } from "@/lib/email";
import { paymentsEnabled } from "@/lib/payments";
import {
  cartFromForm, placeShopOrder, cancelShopOrder, saveProduct, shopOrder, shopItems, itemsSummary,
  attachableTuneOrders, minDeliverDate, shopOrderCode,
} from "@/lib/shop";
import { createShopCheckout } from "@/lib/shop-payments";
import type { FormState } from "@/app/actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Customer buys retail items, either riding along with a tune's return or delivered alone. */
export async function buyItems(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (u.role !== "customer") return { error: "Operator accounts can't place orders. Log in as a customer." };
  const cart = cartFromForm(fd);
  if (cart.size === 0) return { error: "Add at least one item." };

  const deliver = str(fd, "deliver");
  let tuneOrderId: number | null = null;
  let deliverDate: string;
  if (deliver.startsWith("tune:")) {
    const t = attachableTuneOrders(u.id).find((o) => o.id === Number(deliver.slice(5)));
    if (!t) return { error: "That tune isn't open any more. Choose another delivery option." };
    tuneOrderId = t.id;
    deliverDate = t.due_date;
  } else {
    deliverDate = str(fd, "deliver_date");
    if (!isDate(deliverDate)) return { error: "Choose a delivery date." };
    if (deliverDate < minDeliverDate()) return { error: "Delivery date must be tomorrow or later." };
  }

  const res = placeShopOrder({ userId: u.id, cart, tuneOrderId, deliverDate, notes: str(fd, "notes") });
  if ("error" in res) return { error: res.error };

  const items = shopItems(res.id);
  const total = items.reduce((s, i) => s + i.unit_cents * i.qty, 0);
  await sendEmail({
    userId: u.id, to: u.email, kind: "shop-confirmation",
    subject: `Order ${shopOrderCode(res.id)}: ${itemsSummary(items)}`,
    body: [
      `Hi ${u.name.split(" ")[0]},`, "",
      `Thanks for your order:`, "",
      ...items.map((i) => `${i.qty}× ${i.name}  ${money(i.unit_cents * i.qty)}`), "",
      tuneOrderId
        ? `We'll bring these with your tuned gear (tag ${tagCode(tuneOrderId)}) on ${fmtDate(deliverDate, true)}.`
        : `We'll deliver to ${u.address} on ${fmtDate(deliverDate, true)}.`,
      `Total: ${money(total)}`, "",
      `View your order: ${APP_URL}/shop/orders/${res.id}`, "", BUSINESS_NAME,
    ].join("\n"),
  });
  redirect(`/shop/orders/${res.id}?new=1`);
}

export async function cancelMyShopOrder(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  const o = shopOrder(id, u.id);
  // Paid orders go through the operator so the refund is handled too.
  if (o && o.payment_status !== "paid") cancelShopOrder(id);
  revalidatePath(`/shop/orders/${id}`);
}

export async function payShopOrder(fd: FormData) {
  const u = await requireUser();
  const o = shopOrder(Number(fd.get("id")), u.id);
  if (!o || o.payment_status === "paid" || o.status === "cancelled" || !paymentsEnabled()) redirect(`/shop/orders/${o?.id ?? ""}`);
  const session = await createShopCheckout(o, u.email);
  run("UPDATE shop_orders SET stripe_session_id = ? WHERE id = ?", session.id, o.id);
  redirect(session.url);
}

/* ---------- Operator ---------- */

export async function saveProductAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const id = Number(fd.get("id")) || undefined;
  const name = str(fd, "name");
  const price = Number(str(fd, "price").replace(/^\$/, ""));
  const stockRaw = str(fd, "stock");
  const stock = stockRaw === "" ? null : Number(stockRaw);
  if (!name) return { error: "Give the product a name." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter a price like 3.50." };
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return { error: "Stock must be a whole number, or blank for unlimited." };
  saveProduct({
    id, name, description: str(fd, "description"), price_cents: Math.round(price * 100), stock,
    active: !!fd.get("active"), sort: Number(str(fd, "sort")) || 100,
  });
  revalidatePath("/admin/shop/products");
  revalidatePath("/shop");
  return { ok: id ? "Saved." : "Product added." };
}

export async function setShopStatus(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const status = str(fd, "status");
  if (status === "cancelled") cancelShopOrder(id);
  else if (status === "delivered" || status === "pending") {
    const cur = get<{ status: string }>("SELECT status FROM shop_orders WHERE id = ?", id);
    // Re-opening a cancelled order would need stock taken again, so only flip pending <-> delivered.
    if (cur && cur.status !== "cancelled") run("UPDATE shop_orders SET status = ? WHERE id = ?", status, id);
  }
  syncRewards(userIdForShopOrder(id));
  revalidatePath("/admin/shop");
}

export async function setShopPaid(fd: FormData) {
  await requireOperator();
  run("UPDATE shop_orders SET payment_status = ? WHERE id = ?", str(fd, "paid") === "1" ? "paid" : "unpaid", Number(fd.get("id")));
  syncRewards(userIdForShopOrder(Number(fd.get("id"))));
  revalidatePath("/admin/shop");
}
