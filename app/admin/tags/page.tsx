import Link from "next/link";
import { all, tagCode, ORDER_ROW_SQL, type OrderRow } from "@/lib/db";
import { SERVICES, fmtDate, specSummary, todayISO } from "@/lib/services";
import PrintButton from "./PrintButton";
import { extrasByTuneOrder } from "@/lib/shop";

export default async function Tags({ searchParams }: { searchParams: Promise<{ id?: string; date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  let orders: OrderRow[];
  let title: string;
  if (sp.id) {
    orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.id = ?`, Number(sp.id));
    title = `Tag ${tagCode(Number(sp.id))}`;
  } else if (date) {
    orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.pickup_date = ? AND o.status != 'cancelled' ORDER BY o.id`, date);
    title = `Pickups on ${fmtDate(date, true)}`;
  } else {
    orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.status IN ('scheduled','picked_up','in_progress','ready') ORDER BY o.pickup_date, o.id`);
    title = "All active orders";
  }

  const extras = extrasByTuneOrder(orders.map((o) => o.id));
  return (
    <div>
      <div className="no-print card flex between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{title}</h1>
          <span className="muted">{orders.length} tag{orders.length === 1 ? "" : "s"}. Tags print at 4 × 2.6 in; cut along the dashed line and zip-tie through the hole.</span>
        </div>
        <form className="flex" action="/admin/tags">
          <input type="date" name="date" defaultValue={date ?? todayISO()} style={{ width: "auto" }} />
          <button className="btn light sm">Show pickups</button>
          <Link href="/admin/tags" className="btn light sm">All active</Link>
          <PrintButton />
        </form>
      </div>
      <div className="tags">
        {orders.map((o) => (
          <div key={o.id} className="tag">
            <div className="hole" />
            <div className="code">{tagCode(o.id)}</div>
            <div className="name">{o.customer_name}</div>
            <div className="dates">
              <div><small>Pick up</small><b>{fmtDate(o.pickup_date)}</b></div>
              <div className="due"><small>Due / return</small><b>{fmtDate(o.due_date)}</b></div>
            </div>
            <div className="line"><small>Address</small>{o.customer_address}</div>
            <div className="line"><small>Phone</small>{o.customer_phone}</div>
            <div className="line"><small>{o.kind === "snowboard" ? "Board" : "Skis"}</small>{o.description}</div>
            <div className="svc">{SERVICES[o.service].name} · {specSummary(o)}</div>
            {extras.get(o.id)?.map((x) => <div key={x.shopOrderId} className="extras">+ Bring back: {x.text}</div>)}
          </div>
        ))}
        {orders.length === 0 && <p className="muted">No orders match.</p>}
      </div>
    </div>
  );
}
