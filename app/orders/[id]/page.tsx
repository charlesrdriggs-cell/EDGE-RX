import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { get, run, tagCode, ORDER_ROW_SQL, type OrderRow } from "@/lib/db";
import { SERVICES, BASE_REPAIR, STATUS_LABEL, fmtDate, money, specSummary } from "@/lib/services";
import { paymentsEnabled, isCheckoutPaid } from "@/lib/payments";
import { cancelOrder, payOrder } from "@/app/actions";
import { extrasByTuneOrder, shopOrderCode } from "@/lib/shop";

export default async function OrderPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; paid?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  const where = u.role === "operator" ? "WHERE o.id = ?" : "WHERE o.id = ? AND o.user_id = ?";
  const args = u.role === "operator" ? [Number(id)] : [Number(id), u.id];
  let o = get<OrderRow>(`${ORDER_ROW_SQL} ${where}`, ...args);
  if (!o) notFound();

  // Returning from Stripe Checkout: verify with Stripe before marking paid
  if (sp.paid && o.payment_status !== "paid" && paymentsEnabled() && sp.paid === o.stripe_session_id) {
    try {
      if (await isCheckoutPaid(sp.paid, o.id)) {
        run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", o.id);
        o = { ...o, payment_status: "paid" };
      }
    } catch { /* leave unpaid; operator can reconcile */ }
  }

  const s = SERVICES[o.service];
  const extras = extrasByTuneOrder([o.id]).get(o.id) ?? [];
  const canAddExtras = u.role === "customer" && ["scheduled", "picked_up", "in_progress", "ready"].includes(o.status);
  return (
    <main className="page container">
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        {sp.new && <div className="notice">You&apos;re booked! A confirmation email is on its way.</div>}
        <div className="card">
          <div className="flex between">
            <span className="badge">Tag {tagCode(o.id)}</span>
            <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <h1 style={{ marginTop: 12, fontSize: "1.8rem" }}>{s.name}</h1>
          <p className="muted" style={{ marginTop: 0 }}>{specSummary(o)}</p>
          <table>
            <tbody>
              <tr><th>Gear</th><td>{o.kind === "snowboard" ? "Snowboard" : "Skis"}: {o.description}</td></tr>
              <tr><th>Pickup</th><td>{fmtDate(o.pickup_date, true)}</td></tr>
              <tr><th>Return</th><td>{fmtDate(o.due_date, true)}</td></tr>
              <tr><th>Address</th><td>{o.customer_address}</td></tr>
              <tr><th>Phone</th><td>{o.customer_phone}</td></tr>
              {o.notes && <tr><th>Notes</th><td>{o.notes}</td></tr>}
              <tr><th>{s.name}</th><td>{money(s.priceCents)}</td></tr>
              {!!o.base_repair && <tr><th>{BASE_REPAIR.name}</th><td>{money(BASE_REPAIR.priceCents)}</td></tr>}
              <tr><th>Total</th><td><strong>{money(o.price_cents)}</strong> · {o.payment_status === "paid" ? "Paid" : "Unpaid"}</td></tr>
            </tbody>
          </table>
          <div className="flex" style={{ marginTop: 20 }}>
            {o.payment_status !== "paid" && o.status !== "cancelled" && (
              paymentsEnabled() ? (
                <form action={payOrder}><input type="hidden" name="id" value={o.id} /><button className="btn accent">Pay {money(o.price_cents)} now</button></form>
              ) : (
                <span className="muted">Pay at pickup (cash, Venmo or card).</span>
              )
            )}
            {o.status === "scheduled" && u.role === "customer" && (
              <form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><button className="btn ghost sm">Cancel booking</button></form>
            )}
          </div>
        </div>
        {(extras.length > 0 || canAddExtras) && (
          <div className="card">
            <h2>Extras</h2>
            {extras.length === 0 ? (
              <p className="muted" style={{ marginTop: 0 }}>Want hand warmers or clean goggles? Add them and they come back with your gear.</p>
            ) : (
              <table>
                <tbody>
                  {extras.map((x) => (
                    <tr key={x.shopOrderId}>
                      <th><Link href={`/shop/orders/${x.shopOrderId}`}>{shopOrderCode(x.shopOrderId)}</Link></th>
                      <td>{x.text}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{money(x.cents)} · {x.paid ? "Paid" : "Unpaid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canAddExtras && <Link href={`/shop?tune=${o.id}`} className="btn light sm" style={{ marginTop: 12 }}>Add extras</Link>}
          </div>
        )}
        <Link href={u.role === "operator" ? "/admin" : "/account"}>← Back</Link>
      </div>
    </main>
  );
}
