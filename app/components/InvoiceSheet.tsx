import "./invoice.css";
import LogoMark from "@/app/components/LogoMark";
import { tagCode } from "@/lib/db";
import { BUSINESS_NAME, APP_URL } from "@/lib/email";
import { SERVICES, BASE_REPAIR, fmtDate, money, orderLines, specSummary, todayISO } from "@/lib/services";
import type { Invoice, PaymentInfo } from "@/lib/invoices";

const host = APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Printable invoice for one booking. With `driver`, it also prints the driver's pickup and
 * drop off check boxes and a payment-collected line, so it works as the run sheet.
 */
export default function InvoiceSheet({ inv, pay, driver = false }: { inv: Invoice; pay: PaymentInfo; driver?: boolean }) {
  const c = inv.orders[0];
  const email = c.customer_email;
  const paidInFull = inv.dueCents === 0;
  return (
    <article className="invoice">
      <header className="inv-head">
        <div className="inv-brand">
          <LogoMark size={44} bg="#0E2A47" peak="#fff" />
          <div>
            <div className="inv-biz">{BUSINESS_NAME}</div>
            <div className="inv-small">Ski &amp; snowboard tuning · pickup and drop off</div>
            <div className="inv-small">{host}{pay.contact ? ` · ${pay.contact}` : ""}</div>
          </div>
        </div>
        <div className="inv-meta">
          <div className="inv-title">Invoice</div>
          <div className="inv-num">{inv.number}</div>
          <div className="inv-small">Issued {fmtDate(todayISO(), true)}</div>
          <div className={`inv-state ${paidInFull ? "paid" : "due"}`}>{paidInFull ? "Paid in full" : `Balance due ${money(inv.dueCents)}`}</div>
        </div>
      </header>

      <section className="inv-who">
        <div>
          <div className="inv-label">Customer</div>
          <div className="inv-name">{c.customer_name}</div>
          <div>{c.customer_phone || <span className="inv-small">No phone on file</span>}</div>
          <div className="inv-small">{email}</div>
        </div>
        <div>
          <div className="inv-label">Pickup &amp; drop off address</div>
          <div className="inv-addr">{c.customer_address || "No address on file"}</div>
          <div className="inv-spot">
            <span className="inv-label">Gear left at</span> {c.customer_pickup_spot || "Not specified: call or text on arrival"}
          </div>
        </div>
      </section>

      <section className="inv-dates">
        <div><div className="inv-label">Pickup</div><div className="inv-date">{fmtDate(inv.pickupDate, true)}</div></div>
        <div><div className="inv-label">Return (due)</div><div className="inv-date">{fmtDate(inv.dueDate, true)}</div></div>
        <div><div className="inv-label">Pieces</div><div className="inv-date">{inv.orders.length}</div></div>
      </section>

      <table className="inv-lines">
        <thead><tr><th>Tag</th><th>Item</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {inv.orders.map((o) => {
            const lines = orderLines(o);
            const free = o.promo === "early-season";
            return (
              <tr key={o.id}>
                <td className="mono">{tagCode(o.id)}</td>
                <td>
                  <strong>{o.owner_name ? `${o.owner_name}'s ` : ""}{o.kind === "snowboard" ? "snowboard" : "skis"}</strong>: {o.description}
                  <div>{o.racer_name ? "#SKIFAST team tune" : SERVICES[o.service].name}{free ? " (free: early season, tune 3 get 1)" : ""}</div>
                  <div className="inv-small">{specSummary(o)}</div>
                  {o.notes && <div className="inv-small">Note: {o.notes}</div>}
                  {o.pickup_date !== inv.pickupDate || o.due_date !== inv.dueDate ? (
                    <div className="inv-small">Pickup {fmtDate(o.pickup_date)} · Return {fmtDate(o.due_date)}</div>
                  ) : null}
                </td>
                <td className="r">
                  <div>{free ? <><s>{money(lines.service)}</s> {money(0)}</> : money(lines.service)}</div>
                  {!!o.base_repair && <div className="inv-small">+ {BASE_REPAIR.name} {money(lines.repair)}</div>}
                  {o.credit_cents > 0 && <div className="inv-small">Credit −{money(o.credit_cents)}</div>}
                  <div className="inv-small">{o.payment_status === "paid" ? "Paid" : "Unpaid"}</div>
                </td>
              </tr>
            );
          })}
          {inv.extras.map((x) => (
            <tr key={`x${x.shopOrderId}`}>
              <td className="mono">{tagCode(x.tuneOrderId)}</td>
              <td>Extras: {x.text}<div className="inv-small">Returned with the gear</div></td>
              <td className="r">{money(x.cents)}<div className="inv-small">{x.paid ? "Paid" : "Unpaid"}</div></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td /><th>Total</th><td className="r">{money(inv.totalCents)}</td></tr>
          {inv.paidCents > 0 && <tr><td /><th>Paid</th><td className="r">−{money(inv.paidCents)}</td></tr>}
          <tr className="inv-due"><td /><th>Balance due</th><td className="r">{money(inv.dueCents)}</td></tr>
        </tfoot>
      </table>

      {!paidInFull && (
        <section className="inv-pay">
          <div className="inv-label">How to pay · put <strong>{inv.number}</strong> in the memo</div>
          <div className="inv-pay-grid">
            <div>
              <div className="inv-pay-h">Venmo</div>
              {pay.venmo ? (
                <>
                  <div className="inv-pay-big">@{pay.venmo}</div>
                  <div className="inv-small">venmo.com/u/{pay.venmo}</div>
                </>
              ) : (
                <div className="inv-small">Ask your driver for our Venmo handle.</div>
              )}
            </div>
            <div>
              <div className="inv-pay-h">Cash</div>
              <div>Hand to your driver at pickup or drop off.</div>
              <div className="inv-small">Exact change appreciated.</div>
            </div>
            <div>
              <div className="inv-pay-h">Check</div>
              <div>Payable to <strong>{pay.checkPayee}</strong></div>
              <div className="inv-small">
                {pay.checkMail ? <>Give to your driver or mail to {pay.checkMail}</> : "Give to your driver at pickup or drop off."}
              </div>
            </div>
          </div>
          {pay.note && <p className="inv-note">{pay.note}</p>}
        </section>
      )}

      {driver && (
        <section className="inv-driver">
          <div className="inv-label">Driver</div>
          <div className="inv-driver-grid">
            <div><span className="box" /> Picked up {inv.orders.length} piece{inv.orders.length === 1 ? "" : "s"} · Date ______ Initials ____</div>
            <div><span className="box" /> Delivered · Date ______ Initials ____</div>
            <div>
              Payment collected: <span className="box" /> Venmo <span className="box" /> Cash <span className="box" /> Check # ______ · Amount $______
            </div>
          </div>
        </section>
      )}
      <div className="inv-foot">Thank you for tuning with {BUSINESS_NAME}! Questions about this invoice? Reply to your booking email{pay.contact ? ` or reach us at ${pay.contact}` : ""}.</div>
    </article>
  );
}
