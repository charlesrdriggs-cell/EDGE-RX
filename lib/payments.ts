import { APP_URL, BUSINESS_NAME } from "./email";
import { SERVICES, BASE_REPAIR } from "./services";
import type { Order } from "./db";

export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

async function stripe(path: string, init?: { method?: string; body?: URLSearchParams }) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init?.body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Stripe error ${res.status}`);
  return json;
}

/** Creates a Stripe Checkout session for an order and returns its URL. */
export async function createCheckout(order: Order, customerEmail: string) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("customer_email", customerEmail);
  p.set("success_url", `${APP_URL}/orders/${order.id}?paid={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${APP_URL}/orders/${order.id}`);
  p.set("metadata[order_id]", String(order.id));
  const items = [{ name: `${BUSINESS_NAME}: ${SERVICES[order.service].name}`, cents: SERVICES[order.service].priceCents }];
  if (order.base_repair) items.push({ name: BASE_REPAIR.name, cents: BASE_REPAIR.priceCents });
  items.forEach((it, i) => {
    p.set(`line_items[${i}][quantity]`, "1");
    p.set(`line_items[${i}][price_data][currency]`, "usd");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(it.cents));
    p.set(`line_items[${i}][price_data][product_data][name]`, it.name);
  });
  const session = await stripe("checkout/sessions", { method: "POST", body: p });
  return { id: session.id as string, url: session.url as string };
}

/** Confirms with Stripe that a checkout session for this order was paid. */
export async function isCheckoutPaid(sessionId: string, orderId: number) {
  const s = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  return s.payment_status === "paid" && s.metadata?.order_id === String(orderId);
}
