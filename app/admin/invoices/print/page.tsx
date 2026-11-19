import Link from "next/link";
import { fmtDate, money } from "@/lib/services";
import { BUSINESS_NAME } from "@/lib/email";
import { getPaymentInfo, routeStops, ROUTE_TYPES } from "@/lib/invoices";
import { routeParams } from "@/lib/route-params";
import RouteTable from "@/app/components/RouteTable";
import InvoiceSheet from "@/app/components/InvoiceSheet";
import PrintPageButton from "@/app/components/PrintPageButton";

/** Print view: the route summary, then one invoice / driver sheet per booking on its own page. */
export default async function PrintRoute({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; type?: string; invoices?: string }> }) {
  const sp = await searchParams;
  const { from, to, type, qs } = routeParams(sp);
  const withInvoices = sp.invoices !== "0";
  const { stops, invoices } = routeStops(from, to, type);
  const pay = getPaymentInfo();
  // Invoices in route order, each booking once even when it is both picked up and delivered in the range
  const order = [...new Set(stops.filter((s) => s.groupId !== null).map((s) => s.groupId!))];
  const collect = order.reduce((t, g) => t + (invoices.get(g)?.dueCents ?? 0), 0) +
    stops.filter((s) => s.source === "retail").reduce((t, s) => t + s.dueCents, 0);
  const range = `${fmtDate(from, true)}${from !== to ? ` to ${fmtDate(to, true)}` : ""}`;

  return (
    <div>
      <div className="flex between no-print" style={{ marginBottom: 16 }}>
        <Link href={`/admin/invoices?${qs}`}>← Back to route sheet</Link>
        <PrintPageButton label={withInvoices ? `Print summary + ${order.length} invoices` : "Print summary"} />
      </div>
      <section className="route-sheet">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "12px 16px" }}>
            <h1 style={{ fontSize: "1.8rem", margin: 0, border: "none", padding: 0 }}>{BUSINESS_NAME} route sheet</h1>
            <div><strong>{range}</strong> · {ROUTE_TYPES[type]}</div>
            <div className="muted">
              {stops.filter((s) => s.kind === "pickup").length} pickups · {stops.filter((s) => s.kind === "delivery").length} deliveries · {money(collect)} to collect
            </div>
          </div>
          <RouteTable stops={stops} />
        </div>
      </section>
      {withInvoices && order.map((g) => {
        const inv = invoices.get(g);
        return inv ? <InvoiceSheet key={g} inv={inv} pay={pay} driver /> : null;
      })}
    </div>
  );
}
