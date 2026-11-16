import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: DatabaseSync | undefined;
}

function init(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer',
      reminders_opt_in INTEGER NOT NULL DEFAULT 1,
      next_trip_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      service TEXT NOT NULL,
      wax_spec TEXT,
      base_bevel TEXT,
      side_edge TEXT,
      base_repair INTEGER NOT NULL DEFAULT 0,
      pickup_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled',
      price_cents INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      stripe_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      delivery TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const opEmail = process.env.OPERATOR_EMAIL;
  const opPass = process.env.OPERATOR_PASSWORD;
  if (opEmail && opPass) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(opEmail);
    if (!existing) {
      db.prepare(
        "INSERT INTO users (email, password_hash, name, role, reminders_opt_in) VALUES (?, ?, ?, 'operator', 0)"
      ).run(opEmail, bcrypt.hashSync(opPass, 10), "Operator");
    }
  }
  return db;
}

export function db(): DatabaseSync {
  if (!globalThis.__db) globalThis.__db = init();
  return globalThis.__db;
}

export type User = {
  id: number;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: "customer" | "operator";
  reminders_opt_in: number;
  next_trip_date: string | null;
  created_at: string;
};

export type Equipment = { id: number; user_id: number; kind: string; description: string };

export type Order = {
  id: number;
  user_id: number;
  equipment_id: number;
  service: "basic" | "race";
  wax_spec: string | null;
  base_bevel: string | null;
  side_edge: string | null;
  base_repair: number;
  pickup_date: string;
  due_date: string;
  notes: string;
  status: string;
  price_cents: number;
  payment_status: string;
  stripe_session_id: string | null;
  created_at: string;
};

export type OrderRow = Order & {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  kind: string;
  description: string;
};

export const ORDER_ROW_SQL = `
  SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
         u.address AS customer_address, e.kind, e.description
  FROM orders o JOIN users u ON u.id = o.user_id JOIN equipment e ON e.id = o.equipment_id`;

export function tagCode(orderId: number) {
  return `T-${String(orderId).padStart(4, "0")}`;
}

/** node:sqlite returns null-prototype objects; normalise to plain typed rows. */
export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params).map((r) => ({ ...r }) as T);
}
export function get<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  const r = db().prepare(sql).get(...params);
  return r ? ({ ...r } as T) : undefined;
}
export function run(sql: string, ...params: (string | number | null)[]) {
  return db().prepare(sql).run(...params);
}
