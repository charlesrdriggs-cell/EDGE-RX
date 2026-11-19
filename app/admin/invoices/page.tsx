import Link from "next/link";
import { fmtDate, addDays, money } from "@/lib/services";
import { getPaymentInfo, routeStops, ROUTE_TYPES } from "@/lib/invoices";
import { routeParams } from "@/lib/route-params";
import { getSetting } from "@/lib/site";
import ActionForm from "@/app/components/ActionForm";
import RouteTable from "@/app/components/RouteTable";
import { savePaymentSettings } from "@/app/invoice-actions";

export default async function Invoices({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; type?: string }> }) {
  const { from, to, type, qs, today } = routeParams(await searchParams);
  const { stops, invoices } = routeStops(from, to, type);
  const pay = getPaymentInfo();
  const pickups = stops.filter((s) => s.kind === "pickup").length;
  const toCollect = [...new Set(stops.filter((s) => s.groupId !== null).map((s) => s.groupId!))]
    .reduce((t, g) => t + (invoices.get(g)?.dueCents ?? 0), 0) +
    stops.filter((s) => s.source === "retail").reduce((t, s) => t + s.dueCents, 0);
  const quick = [
    ["Today", today, today],
    ["Tomorrow", addDays(today, 1), addDays(today, 1)],
    ["Next 7 days", today, addDays(today, 6)],
    ["Next 14 days", today, addDays(today, 13)],
  ] as const;

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Invoices &amp; route sheet</h1>

      <div className="card">
        <h2>Pickups &amp; deliveries</h2>
        <form method="get" className="flex" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}><label>From</label><input type="date" name="from" defaultValue={from} required /></div>
          <div className="field" style={{ margin: 0 }}><label>To</label><input type="date" name="to" defaultValue={to} required /></div>
          <div className="field" style={{ margin: 0 }}>
            <label>Show</label>
            <select name="type" defaultValue={type}>
              {Object.entries(ROUTE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <button className="btn">Show stops</button>
        </form>
        <div className="flex" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {quick.map(([l, f, t]) => (
            <Link key={l} href={`/admin/invoices?${new URLSearchParams({ from: f, to: t, type })}`} className={`btn sm ${f === from && t === to ? "" : "light"}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="flex between" style={{ padding: "16px 16px 8px", flexWrap: "wrap", gap: 10 }}>
          <div>
            <strong>{fmtDate(from, true)}{from !== to ? ` to ${fmtDate(to, true)}` : ""}</strong>
            <div className="muted">{pickups} pickup{pickups === 1 ? "" : "s"} · {stops.length - pickups} deliver{stops.length - pickups === 1 ? "y" : "ies"} · {money(toCollect)} to collect</div>
          </div>
          {stops.length > 0 && (
            <div className="flex" style={{ gap: 8 }}>
              <Link href={`/admin/invoices/print?${qs}&invoices=0`} className="btn sm light">Print summary</Link>
              <Link href={`/admin/invoices/print?${qs}`} className="btn sm accent">Print summary + {invoices.size} invoice{invoices.size === 1 ? "" : "s"}</Link>
            </div>
          )}
        </div>
        <RouteTable stops={stops} />
      </div>

      <div className="card">
        <h2>Payment instructions on invoices</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every invoice lists Venmo, cash and check. Fill in where customers should send money.
          {!pay.venmo && <strong style={{ color: "var(--danger)" }}> Your Venmo handle isn&apos;t set yet, so invoices tell customers to ask the driver.</strong>}
        </p>
        <ActionForm action={savePaymentSettings} submit="Save payment details">
          <div className="row">
            <div className="field"><label>Venmo handle</label><input name="pay_venmo" defaultValue={pay.venmo ? `@${pay.venmo}` : ""} placeholder="@Edge-RX" /></div>
            <div className="field"><label>Make checks payable to</label><input name="pay_check_payee" defaultValue={getSetting("pay_check_payee") ?? ""} placeholder={pay.checkPayee} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Mail checks to <span className="hint">(optional)</span></label><input name="pay_check_mail" defaultValue={pay.checkMail} placeholder="123 Main St, Town, ST 00000" /></div>
            <div className="field"><label>Phone or email on invoices <span className="hint">(optional)</span></label><input name="pay_contact" defaultValue={pay.contact} placeholder="(555) 555-0100" /></div>
          </div>
          <div className="field"><label>Extra note <span className="hint">(optional, printed under payment options)</span></label><textarea name="pay_note" rows={2} defaultValue={pay.note} placeholder="e.g. Payment is due at drop off." /></div>
        </ActionForm>
      </div>
    </div>
  );
}
