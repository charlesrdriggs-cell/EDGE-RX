import Link from "next/link";
import { tagCode } from "@/lib/db";
import { fmtDate, money, todayISO } from "@/lib/services";
import { shopOrders, shopItems, itemsSummary, shopOrderCode, SHOP_STATUS_LABEL } from "@/lib/shop";
import { setShopStatus, setShopPaid } from "@/app/shop-actions";

const VIEWS = {
  pending: { label: "To deliver", where: "s.status = 'pending'" },
  delivered: { label: "Delivered", where: "s.status = 'delivered'" },
  all: { label: "All", where: "1=1" },
} as const;

export default async function AdminShop({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: v } = await searchParams;
  const view = (v && v in VIEWS ? v : "pending") as keyof typeof VIEWS;
  const today = todayISO();
  const orders = shopOrders(VIEWS[view].where);
  return (
    <div className="stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Retail orders</h1>
        <Link href="/admin/shop/products" className="btn">Manage products</Link>
      </div>
      <div>
        <div className="tabs">
          {Object.entries(VIEWS).map(([k, x]) => (
            <Link key={k} href={`/admin/shop?view=${k}`} className={k === view ? "on" : ""}>{x.label}</Link>
          ))}
        </div>
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Deliver</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>Nothing here.</td></tr>}
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ whiteSpace: "nowrap" }}><Link href={`/shop/orders/${o.id}`}><strong>{shopOrderCode(o.id)}</strong></Link></td>
                  <td>
                    <strong>{o.customer_name}</strong>
                    <div className="muted">{o.customer_phone}</div>
                    <div className="muted" style={{ maxWidth: 200 }}>{o.customer_address}</div>
                  </td>
                  <td>
                    {itemsSummary(shopItems(o.id))}
                    {o.notes && <div className="muted" style={{ fontStyle: "italic" }}>“{o.notes}”</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fmtDate(o.deliver_date)}
                    {o.deliver_date === today && <div className="badge">Today</div>}
                    <div className="muted">
                      {o.tune_order_id ? <>With <Link href={`/orders/${o.tune_order_id}`}>{tagCode(o.tune_order_id)}</Link></> : "On its own"}
                    </div>
                  </td>
                  <td>
                    <form key={`${o.id}-${o.status}`} action={setShopStatus} className="inline-form">
                      <input type="hidden" name="id" value={o.id} />
                      <select name="status" defaultValue={o.status} aria-label="Status" disabled={o.status === "cancelled"}>
                        {Object.entries(SHOP_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      {o.status !== "cancelled" && <button className="btn sm">Save</button>}
                    </form>
                  </td>
                  <td>
                    <form key={`${o.id}-${o.payment_status}`} action={setShopPaid} className="inline-form">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="paid" value={o.payment_status === "paid" ? "0" : "1"} />
                      <span style={{ whiteSpace: "nowrap" }}>{money(o.total_cents)}</span>
                      <button className={`btn sm ${o.payment_status === "paid" ? "light" : "ghost"}`} title="Toggle paid">
                        {o.payment_status === "paid" ? "Paid ✓" : "Mark paid"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
