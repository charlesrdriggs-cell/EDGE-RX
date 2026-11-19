import "./invoice.css";
import Link from "next/link";
import { tagCode } from "@/lib/db";
import { fmtDate, money } from "@/lib/services";
import { invoiceNumber, type Stop } from "@/lib/invoices";
import { shopOrderCode } from "@/lib/shop";

/** The driver's summary: one row per stop, grouped by day. */
export default function RouteTable({ stops }: { stops: Stop[] }) {
  if (stops.length === 0) return <p className="muted" style={{ padding: 16, margin: 0 }}>No pickups or deliveries in this range.</p>;
  const days = [...new Set(stops.map((s) => s.date))];
  return (
    <div className="table-wrap">
      <table className="route-table">
        <thead>
          <tr><th>#</th><th>Stop</th><th>Customer</th><th>Address</th><th>Gear / items</th><th>Collect</th><th>Invoice</th></tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const list = stops.filter((s) => s.date === d);
            const pu = list.filter((s) => s.kind === "pickup").length;
            return [
              <tr key={d} className="route-day">
                <th colSpan={7}>{fmtDate(d, true)} · {pu} pickup{pu === 1 ? "" : "s"}, {list.length - pu} deliver{list.length - pu === 1 ? "y" : "ies"}</th>
              </tr>,
              ...list.map((s, i) => (
                <tr key={`${d}-${s.kind}-${s.groupId ?? `r${s.shopOrderId}`}`} className={s.done ? "done" : ""}>
                  <td>{i + 1}</td>
                  <td className="kind">{s.kind === "pickup" ? "Pick up" : "Deliver"}{s.done && <div className="muted" style={{ textTransform: "none" }}>Done</div>}</td>
                  <td><strong>{s.customerName}</strong><div>{s.phone}</div></td>
                  <td style={{ maxWidth: 220 }}>
                    {s.address}
                    {s.pickupSpot && <div><strong>Gear at:</strong> {s.pickupSpot}</div>}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {s.pieces.map((p) => <div key={p.tag}><span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}>{tagCode(p.tag)}</span> {p.label}</div>)}
                    {s.items && <div>{s.source === "retail" ? "" : "+ "}{s.items}</div>}
                    {s.notes && <div className="muted" style={{ fontStyle: "italic" }}>“{s.notes}”</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{s.dueCents > 0 ? <strong>{money(s.dueCents)}</strong> : <span className="muted">Paid</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {s.groupId !== null ? (
                      <Link href={`/orders/${s.groupId}/invoice`}>{invoiceNumber(s.groupId)}</Link>
                    ) : (
                      <Link href={`/shop/orders/${s.shopOrderId}`}>{shopOrderCode(s.shopOrderId!)}</Link>
                    )}
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
