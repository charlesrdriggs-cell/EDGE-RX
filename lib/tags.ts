import { all, tagCode, pieceNumbers, ORDER_ROW_SQL, type OrderRow } from "./db";
import { SERVICES, fmtDate, specSummary } from "./services";
import { extrasByTuneOrder } from "./shop";

/** Gear tags: one per piece. Labels are 4" x 2.5" (Zebra ZD421/ZD620/ZD621/GC420/GK420/GX430/LP2844/ZP500 stock). */
export const LABEL = { widthIn: 4, heightIn: 2.5 };

export type TagSelection = { id?: string; date?: string; group?: string };

export type Tag = {
  id: number;
  code: string;
  n: number;
  total: number;
  customer: string;
  owner: string;
  pickup: string;
  due: string;
  address: string;
  spot: string;
  phone: string;
  gearLabel: string;
  gear: string;
  service: string;
  extras: string[];
};

/** The orders a tag page / ZPL download covers, plus a title for the page. */
export function selectTagOrders(sp: TagSelection): { orders: OrderRow[]; title: string; date: string | null } {
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  if (sp.group) {
    const g = Number(sp.group);
    return { date, title: `Tags for pickup ${tagCode(g)}`, orders: all<OrderRow>(`${ORDER_ROW_SQL} WHERE (o.id = ? OR o.group_id = ?) AND o.status != 'cancelled' ORDER BY o.id`, g, g) };
  }
  if (sp.id) {
    return { date, title: `Tag ${tagCode(Number(sp.id))}`, orders: all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.id = ?`, Number(sp.id)) };
  }
  if (date) {
    return { date, title: `Pickups on ${fmtDate(date, true)}`, orders: all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.pickup_date = ? AND o.status != 'cancelled' ORDER BY o.id`, date) };
  }
  return {
    date,
    title: "All active orders",
    orders: all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.status IN ('scheduled','picked_up','in_progress','ready') ORDER BY o.pickup_date, o.id`),
  };
}

export function buildTags(orders: OrderRow[]): Tag[] {
  const extras = extrasByTuneOrder(orders.map((o) => o.id));
  const pieces = pieceNumbers(orders);
  return orders.map((o) => ({
    id: o.id,
    code: tagCode(o.id),
    n: pieces.get(o.id)?.n ?? 1,
    total: pieces.get(o.id)?.total ?? 1,
    customer: o.customer_name,
    owner: o.owner_name && o.owner_name !== o.customer_name ? o.owner_name : "",
    pickup: fmtDate(o.pickup_date),
    due: fmtDate(o.due_date),
    address: o.customer_address,
    spot: o.customer_pickup_spot,
    phone: o.customer_phone,
    gearLabel: o.kind === "snowboard" ? "Board" : "Skis",
    gear: o.description,
    service: `${SERVICES[o.service].name} · ${specSummary(o)}${o.promo === "early-season" ? " · FREE (3+1)" : ""}`,
    extras: (extras.get(o.id) ?? []).map((x) => x.text),
  }));
}

/* ---------- ZPL (Zebra Programming Language) ---------- */

/** Escapes text for a ^FH field: ^, ~ and _ become hex so they can't end the field or start a command. */
function fd(s: string) {
  return s.replace(/\s+/g, " ").trim().replace(/[_^~\\]/g, (c) => `_${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Rescales a 203 dpi layout's dot positions and sizes for another resolution. Field data is escaped, so it can't match. */
function scaleZpl(zpl: string, dpi: number) {
  if (dpi === 203) return zpl;
  const k = (n: string) => String(Math.round((Number(n) * dpi) / 203));
  return zpl
    .replace(/\^FO(\d+),(\d+)/g, (_, x, y) => `^FO${k(x)},${k(y)}`)
    .replace(/\^A0N,(\d+),(\d+)/g, (_, h, w) => `^A0N,${k(h)},${k(w)}`)
    .replace(/\^GB(\d+),(\d+),(\d+)/g, (_, w, h, t) => `^GB${k(w)},${k(h)},${k(t)}`)
    .replace(/\^FB(\d+),(\d+),(\d+)/g, (_, w, n, sp) => `^FB${k(w)},${n},${k(sp)}`)
    .replace(/\^PW(\d+)/g, (_, w) => `^PW${k(w)}`)
    .replace(/\^LL(\d+)/g, (_, h) => `^LL${k(h)}`);
}

/**
 * One ^XA…^XZ label per tag, laid out in 203 dpi dots (812 x 508 = 4" x 2.5") and rescaled for 300 dpi printers
 * (812 x 300/203 = 1200 dots wide; the length is pinned to exactly 750).
 */
export function tagsToZpl(tags: Tag[], dpi: 203 | 300 = 203): string {
  const out = scaleZpl(layoutZpl(tags), dpi);
  return dpi === 300 ? out.replace(/\^PW\d+/g, "^PW1200").replace(/\^LL\d+/g, "^LL750") : out;
}

function layoutZpl(tags: Tag[]): string {
  const W = 812, H = 508, M = 24;
  return tags.map((t) => {
    const f: string[] = [
      "^XA",
      "^CI28", // UTF-8 text (accents, °)
      `^PW${W}`, `^LL${H}`, "^LH0,0", "^PON",
      // Header: brand, tag code, piece N of total
      `^FO${M},18^A0N,22,22^FDEDGE RX^FS`,
      `^FO${M},42^A0N,50,46^FD${t.code}^FS`,
      `^FO${W - M - 150},26^GB150,54,3^FS`,
      `^FO${W - M - 150},40^FB150,1,0,C^A0N,32,32^FD${t.n} of ${t.total}^FS`,
      // Customer and owner
      `^FO${M},98^FB${W - 2 * M},1,0,L^A0N,34,32^FH^FD${fd(clip(t.customer + (t.owner ? ` · ${t.owner}` : ""), 44))}^FS`,
      // Dates box
      `^FO${M},140^GB${W - 2 * M},72,3^FS`,
      `^FO${W / 2},140^GB3,72,3^FS`,
      `^FO${M + 12},148^A0N,18,18^FDPICK UP^FS`,
      `^FO${M + 12},170^A0N,34,32^FH^FD${fd(t.pickup)}^FS`,
      `^FO${W / 2 + 14},148^A0N,18,18^FDDUE / RETURN^FS`,
      `^FO${W / 2 + 14},170^A0N,36,34^FH^FD${fd(t.due)}^FS`,
    ];
    // Detail lines
    const lines: [string, string][] = [
      ["ADDRESS", t.address],
      ...(t.spot ? ([["LEFT AT", t.spot]] as [string, string][]) : []),
      ["PHONE", t.phone],
      [t.gearLabel.toUpperCase(), t.gear],
    ];
    let y = 224;
    for (const [label, value] of lines) {
      f.push(`^FO${M},${y + 4}^A0N,17,17^FD${label}^FS`);
      f.push(`^FO${M + 110},${y}^FB${W - 2 * M - 110},1,0,L^A0N,25,24^FH^FD${fd(clip(value, 48))}^FS`);
      y += 30;
    }
    // Service (up to 2 lines) and extras
    y += 4;
    f.push(`^FO${M},${y}^GB${W - 2 * M},2,2^FS`);
    f.push(`^FO${M},${y + 8}^FB${W - 2 * M},2,2,L^A0N,24,23^FH^FD${fd(t.service)}^FS`);
    y += 62;
    if (t.extras.length && y < H - 30) {
      f.push(`^FO${M},${y}^FB${W - 2 * M},1,0,L^A0N,22,21^FH^FD${fd(clip(`+ Bring back: ${t.extras.join("; ")}`, 64))}^FS`);
    }
    f.push("^XZ");
    return f.join("\n");
  }).join("\n");
}
