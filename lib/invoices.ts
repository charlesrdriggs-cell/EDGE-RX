import { all, ORDER_ROW_SQL, type OrderRow } from "./db";
import { BUSINESS_NAME } from "./email";
import { getSetting } from "./site";
import { amountDue } from "./referrals";
import { extrasByTuneOrder, shopItems, shopOrders, itemsSummary, type ShopOrderRow } from "./shop";

/**
 * Invoices and the driver's route sheet. One invoice covers one booking: every piece of
 * gear picked up together (orders sharing a group_id), plus any retail extras riding along.
 * The printed invoice doubles as the driver's pickup and delivery sheet.
 */

/* ---------- Payment instructions (operator edits these at /admin/invoices) ---------- */

export type PaymentInfo = {
  venmo: string;
  checkPayee: string;
  checkMail: string;
  contact: string;
  note: string;
};

export function getPaymentInfo(): PaymentInfo {
  return {
    venmo: (getSetting("pay_venmo") ?? "").replace(/^@+/, ""),
    checkPayee: getSetting("pay_check_payee") || BUSINESS_NAME,
    checkMail: getSetting("pay_check_mail") ?? "",
    contact: getSetting("pay_contact") ?? "",
    note: getSetting("pay_note") ?? "",
  };
}

/* ---------- One booking's invoice ---------- */

export function invoiceNumber(groupId: number) {
  return `INV-${String(groupId).padStart(4, "0")}`;
}

export const groupKey = (o: { id: number; group_id: number | null }) => o.group_id ?? o.id;

export type InvoiceExtra = { shopOrderId: number; tuneOrderId: number; text: string; cents: number; paid: boolean };

export type Invoice = {
  number: string;
  groupId: number;
  userId: number;
  orders: OrderRow[];
  extras: InvoiceExtra[];
  /** Earliest pickup and latest return across the booking's pieces */
  pickupDate: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  dueCents: number;
};

/** Invoices for the given bookings (group ids), in the order given. Cancelled pieces are left off. */
export function invoicesFor(groupIds: number[]): Invoice[] {
  if (groupIds.length === 0) return [];
  const ph = groupIds.map(() => "?").join(",");
  const rows = all<OrderRow>(
    `${ORDER_ROW_SQL} WHERE COALESCE(o.group_id, o.id) IN (${ph}) AND o.status != 'cancelled' ORDER BY o.id`,
    ...groupIds
  );
  const extras = extrasByTuneOrder(rows.map((r) => r.id));
  const byGroup = new Map<number, OrderRow[]>();
  for (const r of rows) byGroup.set(groupKey(r), [...(byGroup.get(groupKey(r)) ?? []), r]);

  const out: Invoice[] = [];
  for (const g of groupIds) {
    const orders = byGroup.get(g);
    if (!orders?.length) continue;
    const ex: InvoiceExtra[] = orders.flatMap((o) => (extras.get(o.id) ?? []).map((x) => ({ ...x, tuneOrderId: o.id })));
    let total = 0;
    let paid = 0;
    for (const o of orders) {
      const c = amountDue(o);
      total += c;
      if (o.payment_status === "paid") paid += c;
    }
    for (const x of ex) {
      total += x.cents;
      if (x.paid) paid += x.cents;
    }
    out.push({
      number: invoiceNumber(g),
      groupId: g,
      userId: orders[0].user_id,
      orders,
      extras: ex,
      pickupDate: orders.map((o) => o.pickup_date).sort()[0],
      dueDate: orders.map((o) => o.due_date).sort().at(-1)!,
      totalCents: total,
      paidCents: paid,
      dueCents: total - paid,
    });
  }
  return out;
}

/** The booking an order belongs to, if it exists and isn't fully cancelled. */
export function invoiceForOrder(orderId: number): Invoice | undefined {
  const r = all<{ g: number }>("SELECT COALESCE(group_id, id) g FROM orders WHERE id = ?", orderId)[0];
  return r ? invoicesFor([r.g])[0] : undefined;
}

/* ---------- Route sheet: pickups and deliveries in a date range ---------- */

export type StopKind = "pickup" | "delivery";

export type Stop = {
  kind: StopKind;
  date: string;
  /** "tune" stops carry an invoice; "retail" stops are extras delivered on their own */
  source: "tune" | "retail";
  groupId: number | null;
  shopOrderId: number | null;
  customerName: string;
  phone: string;
  address: string;
  pickupSpot: string;
  pieces: { tag: number; label: string }[];
  items: string;
  notes: string;
  dueCents: number;
  done: boolean;
};

export const ROUTE_TYPES = { all: "Pickups & deliveries", pickup: "Pickups only", delivery: "Deliveries only" } as const;
export type RouteType = keyof typeof ROUTE_TYPES;

const pieceLabel = (o: OrderRow) =>
  `${o.owner_name ? `${o.owner_name}: ` : ""}${o.kind === "snowboard" ? "Snowboard" : "Skis"}, ${o.description}`;

/**
 * Every stop the driver makes between `from` and `to` (inclusive), by date then customer.
 * A booking whose pieces share a date is one stop. Pickups use the pickup date, deliveries
 * use the return (due) date. Retail orders not attached to a tune are their own deliveries.
 */
export function routeStops(from: string, to: string, type: RouteType = "all"): { stops: Stop[]; invoices: Map<number, Invoice> } {
  const stops: Stop[] = [];
  const want = (k: StopKind) => type === "all" || type === k;

  const rows = all<OrderRow & { g: number }>(
    `${ORDER_ROW_SQL.replace("SELECT o.*,", "SELECT o.*, COALESCE(o.group_id, o.id) AS g,")}
     WHERE o.status != 'cancelled' AND ((o.pickup_date BETWEEN ? AND ?) OR (o.due_date BETWEEN ? AND ?))
     ORDER BY o.id`,
    from, to, from, to
  );
  const groupIds = [...new Set(rows.map((r) => r.g))];
  const invoices = new Map(invoicesFor(groupIds).map((i) => [i.groupId, i]));

  for (const kind of ["pickup", "delivery"] as const) {
    if (!want(kind)) continue;
    const field = kind === "pickup" ? "pickup_date" : "due_date";
    const buckets = new Map<string, (OrderRow & { g: number })[]>();
    for (const r of rows) {
      const d = r[field];
      if (d < from || d > to) continue;
      const k = `${r.g}|${d}`;
      buckets.set(k, [...(buckets.get(k) ?? []), r]);
    }
    for (const list of buckets.values()) {
      const first = list[0];
      const inv = invoices.get(first.g);
      const ex = inv?.extras.filter((x) => list.some((o) => o.id === x.tuneOrderId)) ?? [];
      stops.push({
        kind,
        date: first[field],
        source: "tune",
        groupId: first.g,
        shopOrderId: null,
        customerName: first.customer_name,
        phone: first.customer_phone,
        address: first.customer_address,
        pickupSpot: first.customer_pickup_spot,
        pieces: list.map((o) => ({ tag: o.id, label: pieceLabel(o) })),
        items: kind === "delivery" ? ex.map((x) => x.text).join("; ") : "",
        notes: [...new Set(list.map((o) => o.notes).filter(Boolean))].join(" / "),
        dueCents: inv?.dueCents ?? 0,
        done: kind === "pickup" ? list.every((o) => o.status !== "scheduled") : list.every((o) => o.status === "returned"),
      });
    }
  }

  if (want("delivery")) {
    const retail: (ShopOrderRow & { customer_pickup_spot?: string })[] = shopOrders(
      "s.tune_order_id IS NULL AND s.status != 'cancelled' AND s.deliver_date BETWEEN ? AND ?", from, to
    );
    const spots = new Map(
      all<{ id: number; pickup_spot: string }>(
        `SELECT id, pickup_spot FROM users WHERE id IN (${retail.map(() => "?").join(",") || "NULL"})`,
        ...retail.map((s) => s.user_id)
      ).map((u) => [u.id, u.pickup_spot])
    );
    for (const s of retail) {
      stops.push({
        kind: "delivery",
        date: s.deliver_date,
        source: "retail",
        groupId: null,
        shopOrderId: s.id,
        customerName: s.customer_name,
        phone: s.customer_phone,
        address: s.customer_address,
        pickupSpot: spots.get(s.user_id) ?? "",
        pieces: [],
        items: itemsSummary(shopItems(s.id)),
        notes: s.notes,
        dueCents: s.payment_status === "paid" ? 0 : s.total_cents,
        done: s.status === "delivered",
      });
    }
  }

  stops.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.customerName.localeCompare(b.customerName) || // same customer's drop off and pickup sit together
    (a.kind === b.kind ? 0 : a.kind === "delivery" ? -1 : 1)
  );
  return { stops, invoices };
}
