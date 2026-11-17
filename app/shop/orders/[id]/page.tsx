import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { run, tagCode } from "@/lib/db";
import { fmtDate, money } from "@/lib/services";
import { paymentsEnabled } from "@/lib/payments";
import { shopOrder, shopItems, shopOrderCode, SHOP_STATUS_LABEL } from "@/lib/shop";
import { isShopCheckoutPaid } from "@/lib/shop-payments";
import { cancelMyShopOrder, payShopOrder } from "@/app/shop-actions";

export default async function ShopOrderPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; paid?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  let o = shopOrder(Number(id), u.role === "operator" ? undefined : u.id);
  if (!o) notFound();

  // Returning from Stripe Checkout: verify with Stripe before marking paid
  if (sp.paid && o.payment_status !== "paid" && paymentsEnabled() && sp.paid === o.stripe_session_id) {
    try {
      if (await isShopCheckoutPaid(sp.paid, o.id)) {
        run("UPDATE shop_orders SET payment_status = 'paid' WHERE id = ?", o.id);
        o = { ...o, payment_status: "paid" };
      }
    } catch { /* leave unpaid; operator can reconcile */ }
  }

  const items = shopItems(o.id);
  return (
    <main className="page container">
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        {sp.new && <div className="notice">Order placed! A confirmation email is on its way.</div>}
        <div className="card">
          <div className="flex between">
            <span className="badge">Order {shopOrderCode(o.id)}</span>
            <span className={`status ${o.status === "pending" ? "scheduled" : o.status === "delivered" ? "returned" : "cancelled"}`}>
              {SHOP_STATUS_LABEL[o.status]}
            </span>
          </div>
          <h1 style={{ marginTop: 12, fontSize: "1.8rem" }}>Shop order</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {o.tune_order_id ? (
              <>Coming back with your tuned gear (<Link href={`/orders/${o.tune_order_id}`}>tag {tagCode(o.tune_order_id)}</Link>) on {fmtDate(o.deliver_date, true)}.</>
            ) : (
              <>Delivering to {o.customer_address} on {fmtDate(o.deliver_date, true)}.</>
            )}
          </p>
          <table>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}><th>{i.qty}× {i.name}</th><td>{money(i.unit_cents * i.qty)}</td></tr>
              ))}
              {o.notes && <tr><th>Notes</th><td>{o.notes}</td></tr>}
              <tr><th>Total</th><td><strong>{money(o.total_cents)}</strong> · {o.payment_status === "paid" ? "Paid" : "Unpaid"}</td></tr>
            </tbody>
          </table>
          <div className="flex" style={{ marginTop: 20 }}>
            {o.payment_status !== "paid" && o.status !== "cancelled" && (
              paymentsEnabled() ? (
                <form action={payShopOrder}><input type="hidden" name="id" value={o.id} /><button className="btn accent">Pay {money(o.total_cents)} now</button></form>
              ) : (
                <span className="muted">Pay on delivery (cash, Venmo or card).</span>
              )
            )}
            {o.status === "pending" && o.payment_status !== "paid" && u.role === "customer" && (
              <form action={cancelMyShopOrder}><input type="hidden" name="id" value={o.id} /><button className="btn ghost sm">Cancel order</button></form>
            )}
          </div>
        </div>
        <Link href={u.role === "operator" ? "/admin/shop" : "/account"}>← Back</Link>
      </div>
    </main>
  );
}
