import { APP_URL, BUSINESS_NAME } from "./email";
import { stripe } from "./payments";
import { shopItems, type ShopOrder } from "./shop";

/** Creates a Stripe Checkout session for a retail order and returns its URL. */
export async function createShopCheckout(order: ShopOrder, customerEmail: string) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("customer_email", customerEmail);
  p.set("success_url", `${APP_URL}/shop/orders/${order.id}?paid={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${APP_URL}/shop/orders/${order.id}`);
  p.set("metadata[shop_order_id]", String(order.id));
  shopItems(order.id).forEach((it, i) => {
    p.set(`line_items[${i}][quantity]`, String(it.qty));
    p.set(`line_items[${i}][price_data][currency]`, "usd");
    p.set(`line_items[${i}][price_data][unit_amount]`, String(it.unit_cents));
    p.set(`line_items[${i}][price_data][product_data][name]`, `${BUSINESS_NAME}: ${it.name}`);
  });
  const session = await stripe("checkout/sessions", { method: "POST", body: p });
  return { id: session.id as string, url: session.url as string };
}

/** Confirms with Stripe that a checkout session for this retail order was paid. */
export async function isShopCheckoutPaid(sessionId: string, shopOrderId: number) {
  const s = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  return s.payment_status === "paid" && s.metadata?.shop_order_id === String(shopOrderId);
}
