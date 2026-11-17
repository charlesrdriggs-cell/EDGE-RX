import Link from "next/link";
import { amountDue } from "@/lib/referrals";
import { all, get, tagCode, ORDER_ROW_SQL, type OrderRow } from "@/lib/db";
import { SERVICES, STATUSES, STATUS_LABEL, fmtDate, money, specSummary, todayISO, addDays } from "@/lib/services";
import { setStatus, setPaid } from "@/app/actions";

const VIEWS = {
  active: { label: "Active", where: "o.status IN ('scheduled','picked_up','in_progress','ready')", order: "o.due_date" },
  pickups: { label: "To pick up", where: "o.status = 'scheduled'", order: "o.pickup_date" },
  shop: { label: "In the shop", where: "o.status IN ('picked_up','in_progress')", order: "o.due_date" },
  ready: { label: "Ready to return", where: "o.status = 'ready'", order: "o.due_date" },
  done: { label: "Returned", where: "o.status = 'returned'", order: "o.due_date DESC" },
  all: { label: "All", where: "1=1", order: "o.pickup_date DESC" },
} as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: v } = await searchParams;
  const view = (v && v in VIEWS ? v : "active") as keyof typeof VIEWS;
  const today = todayISO();
  const orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE ${VIEWS[view].where} ORDER BY ${VIEWS[view].order}, o.id`);
  const count = (sql: string, ...p: string[]) => (get<{ n: number }>(`SELECT COUNT(*) n FROM orders o WHERE ${sql}`, ...p)?.n ?? 0);

  const stats = [
    ["Pickups today", count("o.status='scheduled' AND o.pickup_date = ?", today)],
    ["In the shop", count("o.status IN ('picked_up','in_progress')")],
    ["Due back in 2 days", count("o.status IN ('picked_up','in_progress','ready') AND o.due_date <= ?", addDays(today, 2))],
    ["Overdue", count("o.status IN ('picked_up','in_progress','ready') AND o.due_date < ?", today)],
  ] as const;

  return (
    <div className="stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Orders</h1>
        <Link href={`/admin/tags?date=${today}`} className="btn">Print today&apos;s pickup tags</Link>
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {stats.map(([l, n]) => (
          <div key={l} className="card stat"><div className="n" style={l === "Overdue" && n ? { color: "var(--danger)" } : {}}>{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div>
        <div className="tabs">
          {Object.entries(VIEWS).map(([k, x]) => (
            <Link key={k} href={`/admin?view=${k}`} className={k === view ? "on" : ""}>{x.label}</Link>
          ))}
        </div>
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>Tag</th><th>Customer</th><th>Gear &amp; service</th><th>Pickup</th><th>Due</th><th>Status</th><th>Payment</th><th></th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>Nothing here.</td></tr>}
              {orders.map((o) => {
                const overdue = o.due_date < today && ["picked_up", "in_progress", "ready"].includes(o.status);
                return (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: "nowrap" }}><Link href={`/orders/${o.id}`}><strong>{tagCode(o.id)}</strong></Link></td>
                    <td>
                      <strong>{o.customer_name}</strong>
                      <div className="muted">{o.customer_phone}</div>
                      <div className="muted" style={{ maxWidth: 200 }}>{o.customer_address}</div>
                    </td>
                    <td>
                      {o.kind === "snowboard" ? "🏂" : "⛷️"} {o.description}
                      <div className="muted">{SERVICES[o.service].name} · {specSummary(o)}</div>
                      {o.notes && <div className="muted" style={{ fontStyle: "italic" }}>“{o.notes}”</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.pickup_date)}{o.pickup_date === today && <div className="badge">Today</div>}</td>
                    <td style={{ whiteSpace: "nowrap", color: overdue ? "var(--danger)" : undefined, fontWeight: overdue ? 700 : undefined }}>
                      {fmtDate(o.due_date)}{overdue && <div>Overdue</div>}
                    </td>
                    <td>
                      <form key={`${o.id}-${o.status}`} action={setStatus} className="inline-form">
                        <input type="hidden" name="id" value={o.id} />
                        <select name="status" defaultValue={o.status} aria-label="Status">
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <button className="btn sm">Save</button>
                      </form>
                    </td>
                    <td>
                      <form key={`${o.id}-${o.payment_status}`} action={setPaid} className="inline-form">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="paid" value={o.payment_status === "paid" ? "0" : "1"} />
                        <span style={{ whiteSpace: "nowrap" }} title={o.credit_cents ? `${money(o.price_cents)} less ${money(o.credit_cents)} referral credit` : undefined}>
                          {money(amountDue(o))}{o.credit_cents > 0 && <span className="muted"> (credit)</span>}
                        </span>
                        <button className={`btn sm ${o.payment_status === "paid" ? "light" : "ghost"}`} title="Toggle paid">
                          {o.payment_status === "paid" ? "Paid ✓" : "Mark paid"}
                        </button>
                      </form>
                    </td>
                    <td><Link href={`/admin/tags?id=${o.id}`} className="btn sm light">Tag</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
