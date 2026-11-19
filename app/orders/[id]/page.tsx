import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, get, run, tagCode, pieceNumbers, ORDER_ROW_SQL, type OrderRow } from "@/lib/db";
import { syncRewards } from "@/lib/rewards";
import { SERVICES, BASE_REPAIR, STATUS_LABEL, fmtDate, money, specSummary, orderLines } from "@/lib/services";
import { paymentsEnabled, isCheckoutPaid } from "@/lib/payments";
import { cancelOrder, payOrder } from "@/app/actions";
import { amountDue, maybeRewardReferral } from "@/lib/referrals";
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
        await maybeRewardReferral(o.id);
        syncRewards(o.user_id);
      }
    } catch { /* leave unpaid; operator can reconcile */ }
  }

  const s = SERVICES[o.service];
  const extras = extrasByTuneOrder([o.id]).get(o.id) ?? [];
  const piece = pieceNumbers([o]).get(o.id);
  const group = o.group_id
    ? all<{ id: number; description: string; owner_name: string; status: string }>(
        "SELECT o.id, e.description, e.owner_name, o.status FROM orders o JOIN equipment e ON e.id = o.equipment_id WHERE o.group_id = ? ORDER BY o.id",
        o.group_id
      )
    : [];
  const scheduledInGroup = group.filter((g) => g.status === "scheduled").length;
  const canAddExtras = u.role === "customer" && ["scheduled", "picked_up", "in_progress", "ready"].includes(o.status);
  return (
    <main className="page container">
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        {sp.new && <div className="notice">You&apos;re booked! A confirmation email is on its way.</div>}
        <div className="card">
          <div className="flex between">
            <span className="badge">Tag {tagCode(o.id)}{piece && piece.total > 1 ? ` · ${piece.n} of ${piece.total}` : ""}</span>
            <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <h1 style={{ marginTop: 12, fontSize: "1.8rem" }}>{s.name}</h1>
          <p className="muted" style={{ marginTop: 0 }}>{specSummary(o)}</p>
          <table>
            <tbody>
              <tr><th>Gear</th><td>{o.owner_name ? <strong>{o.owner_name}&apos;s </strong> : null}{o.kind === "snowboard" ? "snowboard" : "skis"}: {o.description}</td></tr>
              {o.racer_name && <tr><th>#SKIFAST racer</th><td>{o.racer_name}, {o.racer_team}</td></tr>}
              <tr><th>Pickup</th><td>{fmtDate(o.pickup_date, true)}</td></tr>
              <tr><th>Return</th><td>{fmtDate(o.due_date, true)}</td></tr>
              <tr><th>Address</th><td>{o.customer_address}{o.customer_pickup_spot ? <div className="muted">Gear left at: {o.customer_pickup_spot}</div> : null}</td></tr>
              <tr><th>Phone</th><td>{o.customer_phone}</td></tr>
              {o.notes && <tr><th>Notes</th><td>{o.notes}</td></tr>}
              <tr><th>{o.racer_name ? "#SKIFAST team tune" : s.name}</th><td>{o.promo === "early-season" ? <><s>{money(orderLines(o).service)}</s> Free (early season, tune 3 get 1)</> : money(orderLines(o).service)}</td></tr>
              {!!o.base_repair && <tr><th>{BASE_REPAIR.name}</th><td>{money(orderLines(o).repair)}</td></tr>}
              {o.credit_cents > 0 && <tr><th>Credit</th><td>−{money(o.credit_cents)}</td></tr>}
              <tr><th>Total</th><td><strong>{money(amountDue(o))}</strong> · {o.payment_status === "paid" ? "Paid" : "Unpaid"}</td></tr>
            </tbody>
          </table>
          <div className="flex" style={{ marginTop: 20 }}>
            {o.payment_status !== "paid" && o.status !== "cancelled" && (
              paymentsEnabled() ? (
                <form action={payOrder}><input type="hidden" name="id" value={o.id} /><button className="btn accent">Pay {money(amountDue(o))} now</button></form>
              ) : (
                <span className="muted">Pay at pickup (cash, Venmo or card).</span>
              )
            )}
            {o.status === "scheduled" && u.role === "customer" && (
              <form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><button className="btn ghost sm">{group.length > 1 ? "Cancel this piece" : "Cancel booking"}</button></form>
            )}
            {o.status === "scheduled" && u.role === "customer" && scheduledInGroup > 1 && (
              <form action={cancelOrder}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="all" value="1" /><button className="btn ghost sm">Cancel all {scheduledInGroup} pieces</button></form>
            )}
          </div>
        </div>
        {group.length > 1 && (
          <div className="card">
            <h2>Everything on this pickup</h2>
            <table>
              <tbody>
                {group.map((g, i) => (
                  <tr key={g.id}>
                    <th><Link href={`/orders/${g.id}`}>{tagCode(g.id)}</Link></th>
                    <td>{i + 1} of {group.length}</td>
                    <td>{g.owner_name ? `${g.owner_name}: ` : ""}{g.description}</td>
                    <td><span className={`status ${g.status}`}>{STATUS_LABEL[g.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
