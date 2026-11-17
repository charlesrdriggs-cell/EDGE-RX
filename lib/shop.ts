import { db, all, get, run } from "./db";
import { addDays, todayISO } from "./services";

/**
 * Retail shop: small add-on items (hand/foot warmers, goggle cleaning, ...) that customers
 * add to a tune order or buy on their own. Items ride along with a tune's return drop off,
 * or get delivered on their own date. Kept in its own tables so tune orders are untouched.
 */

export type Product = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  /** null = unlimited (services, or stock you don't want to count) */
  stock: number | null;
  active: number;
  /** 0 until the operator saves the product: seeded prices are placeholders */
  price_confirmed: number;
  sort: number;
  /** uploaded photo id (see lib/media.ts) */
  image_id: string | null;
};

export type ShopOrder = {
  id: number;
  user_id: number;
  tune_order_id: number | null;
  deliver_date: string;
  status: "pending" | "delivered" | "cancelled";
  payment_status: string;
  total_cents: number;
  notes: string;
  stripe_session_id: string | null;
  created_at: string;
};

export type ShopOrderItem = { id: number; shop_order_id: number; product_id: number; name: string; unit_cents: number; qty: number };

export type ShopOrderRow = ShopOrder & { customer_name: string; customer_email: string; customer_phone: string; customer_address: string };

export const SHOP_STATUS_LABEL: Record<string, string> = { pending: "To deliver", delivered: "Delivered", cancelled: "Cancelled" };

export const MAX_QTY = 20;

// Placeholder prices: the operator confirms or changes each one at /admin/shop/products.
const SEED: Omit<Product, "id" | "active" | "price_confirmed" | "image_id">[] = [
  { name: "HOTHANDS Hand Warmers (pair)", description: "Air-activated hand warmers. Slip them in your gloves or pockets for hours of heat.", price_cents: 300, stock: 50, sort: 10 },
  { name: "HOTHANDS Toe Warmers (pair)", description: "Thin adhesive warmers that sit on top of your toes inside ski boots.", price_cents: 350, stock: 50, sort: 20 },
  { name: "HOTHANDS Foot Warmers (insoles)", description: "Full-foot warming insoles for the coldest days on the hill.", price_cents: 400, stock: 30, sort: 30 },
  { name: "Goggle cleaning", description: "Leave your goggles with your gear. We clean the lens and strap and return them in a microfiber bag.", price_cents: 1000, stock: null, sort: 40 },
];

let ready = false;
function ensure() {
  if (ready) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      stock INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      price_confirmed INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tune_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      deliver_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      total_cents INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      stripe_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shop_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_order_id INTEGER NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      unit_cents INTEGER NOT NULL,
      qty INTEGER NOT NULL
    );
  `);
  const cols = all<{ name: string }>("PRAGMA table_info(products)");
  if (!cols.some((c) => c.name === "image_id")) db().exec("ALTER TABLE products ADD COLUMN image_id TEXT");
  const n = get<{ n: number }>("SELECT COUNT(*) n FROM products")?.n ?? 0;
  if (n === 0) {
    for (const p of SEED) {
      run("INSERT INTO products (name, description, price_cents, stock, sort) VALUES (?, ?, ?, ?, ?)", p.name, p.description, p.price_cents, p.stock, p.sort);
    }
  }
  ready = true;
}

export function shopOrderCode(id: number) {
  return `R-${String(id).padStart(4, "0")}`;
}

export function activeProducts(): Product[] {
  ensure();
  return all<Product>("SELECT * FROM products WHERE active = 1 AND (stock IS NULL OR stock > 0) ORDER BY sort, id");
}

export function allProducts(): Product[] {
  ensure();
  return all<Product>("SELECT * FROM products ORDER BY active DESC, sort, id");
}

export function getProduct(id: number) {
  ensure();
  return get<Product>("SELECT * FROM products WHERE id = ?", id);
}

export function saveProduct(p: { id?: number; name: string; description: string; price_cents: number; stock: number | null; active: boolean; sort: number }) {
  ensure();
  if (p.id) {
    run(
      "UPDATE products SET name = ?, description = ?, price_cents = ?, stock = ?, active = ?, sort = ?, price_confirmed = 1 WHERE id = ?",
      p.name, p.description, p.price_cents, p.stock, p.active ? 1 : 0, p.sort, p.id
    );
  } else {
    run(
      "INSERT INTO products (name, description, price_cents, stock, active, sort, price_confirmed) VALUES (?, ?, ?, ?, ?, ?, 1)",
      p.name, p.description, p.price_cents, p.stock, p.active ? 1 : 0, p.sort
    );
  }
}

/** Reads qty_<productId> fields from a form into a cart of positive quantities. */
export function cartFromForm(fd: FormData): Map<number, number> {
  const cart = new Map<number, number>();
  for (const [k, v] of fd.entries()) {
    const m = /^qty_(\d+)$/.exec(k);
    if (!m) continue;
    const q = Math.floor(Number(v));
    if (Number.isFinite(q) && q > 0) cart.set(Number(m[1]), Math.min(q, MAX_QTY));
  }
  return cart;
}

/**
 * Creates a retail order, checking visibility and stock and decrementing stock in one
 * transaction. Returns the new id, or an error message to show the customer.
 */
export function placeShopOrder(o: {
  userId: number; cart: Map<number, number>; tuneOrderId: number | null; deliverDate: string; notes: string;
}): { id: number } | { error: string } {
  ensure();
  if (o.cart.size === 0) return { error: "Add at least one item." };
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    let total = 0;
    const lines: { p: Product; qty: number }[] = [];
    for (const [pid, qty] of o.cart) {
      const p = get<Product>("SELECT * FROM products WHERE id = ? AND active = 1", pid);
      if (!p) throw new Error("One of those items is no longer available.");
      if (p.stock !== null && p.stock < qty) {
        throw new Error(p.stock === 0 ? `${p.name} is sold out.` : `Only ${p.stock} of ${p.name} left.`);
      }
      lines.push({ p, qty });
      total += p.price_cents * qty;
    }
    const id = Number(
      run(
        "INSERT INTO shop_orders (user_id, tune_order_id, deliver_date, total_cents, notes) VALUES (?, ?, ?, ?, ?)",
        o.userId, o.tuneOrderId, o.deliverDate, total, o.notes
      ).lastInsertRowid
    );
    for (const { p, qty } of lines) {
      run("INSERT INTO shop_order_items (shop_order_id, product_id, name, unit_cents, qty) VALUES (?, ?, ?, ?, ?)", id, p.id, p.name, p.price_cents, qty);
      if (p.stock !== null) run("UPDATE products SET stock = stock - ? WHERE id = ?", qty, p.id);
    }
    d.exec("COMMIT");
    return { id };
  } catch (e) {
    d.exec("ROLLBACK");
    return { error: e instanceof Error ? e.message : "Couldn't place that order." };
  }
}

/** Cancels a retail order and puts counted stock back. No-op unless it is still pending. */
export function cancelShopOrder(id: number) {
  ensure();
  const o = get<ShopOrder>("SELECT * FROM shop_orders WHERE id = ?", id);
  if (!o || o.status !== "pending") return;
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    for (const it of shopItems(id)) {
      run("UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL", it.qty, it.product_id);
    }
    run("UPDATE shop_orders SET status = 'cancelled' WHERE id = ?", id);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

/** Cancels any pending retail orders riding along with a tune order that was cancelled. */
export function cancelExtrasForTune(tuneOrderId: number) {
  ensure();
  for (const o of all<{ id: number }>("SELECT id FROM shop_orders WHERE tune_order_id = ? AND status = 'pending'", tuneOrderId)) {
    cancelShopOrder(o.id);
  }
}

export function shopItems(shopOrderId: number): ShopOrderItem[] {
  ensure();
  return all<ShopOrderItem>("SELECT * FROM shop_order_items WHERE shop_order_id = ? ORDER BY id", shopOrderId);
}

const SHOP_ROW_SQL = `
  SELECT s.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone, u.address AS customer_address
  FROM shop_orders s JOIN users u ON u.id = s.user_id`;

export function shopOrder(id: number, userId?: number): ShopOrderRow | undefined {
  ensure();
  return userId === undefined
    ? get<ShopOrderRow>(`${SHOP_ROW_SQL} WHERE s.id = ?`, id)
    : get<ShopOrderRow>(`${SHOP_ROW_SQL} WHERE s.id = ? AND s.user_id = ?`, id, userId);
}

export function shopOrders(where = "1=1", ...params: (string | number)[]): ShopOrderRow[] {
  ensure();
  return all<ShopOrderRow>(`${SHOP_ROW_SQL} WHERE ${where} ORDER BY s.deliver_date, s.id`, ...params);
}

/** Non-cancelled extras attached to each tune order, e.g. for tags and the orders table. */
export function extrasByTuneOrder(tuneOrderIds: number[]): Map<number, { shopOrderId: number; text: string; cents: number; paid: boolean }[]> {
  ensure();
  const out = new Map<number, { shopOrderId: number; text: string; cents: number; paid: boolean }[]>();
  if (tuneOrderIds.length === 0) return out;
  const rows = all<ShopOrder>(
    `SELECT * FROM shop_orders WHERE status != 'cancelled' AND tune_order_id IN (${tuneOrderIds.map(() => "?").join(",")}) ORDER BY id`,
    ...tuneOrderIds
  );
  for (const s of rows) {
    const text = itemsSummary(shopItems(s.id));
    const list = out.get(s.tune_order_id!) ?? [];
    list.push({ shopOrderId: s.id, text, cents: s.total_cents, paid: s.payment_status === "paid" });
    out.set(s.tune_order_id!, list);
  }
  return out;
}

export function itemsSummary(items: ShopOrderItem[]) {
  return items.map((i) => `${i.qty}× ${i.name}`).join(", ");
}

/** Tune orders a customer can attach extras to: not yet returned or cancelled. */
export function attachableTuneOrders(userId: number) {
  return all<{ id: number; due_date: string; description: string }>(
    `SELECT o.id, o.due_date, e.description FROM orders o JOIN equipment e ON e.id = o.equipment_id
     WHERE o.user_id = ? AND o.status IN ('scheduled','picked_up','in_progress','ready') AND o.due_date > ?
     ORDER BY o.due_date`,
    userId, todayISO()
  );
}

export function minDeliverDate() {
  return addDays(todayISO(), 1);
}

export function setProductImage(id: number, imageId: string | null) {
  ensure();
  const old = get<{ image_id: string | null }>("SELECT image_id FROM products WHERE id = ?", id)?.image_id ?? null;
  run("UPDATE products SET image_id = ? WHERE id = ?", imageId, id);
  return old;
}
