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
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocked_dates (
      date TEXT PRIMARY KEY,
      reason TEXT NOT NULL DEFAULT ''
    );
  `);

  syncOperator(db);
  migrateReferrals(db);
  return db;
}

function hasColumn(db: DatabaseSync, table: string, col: string) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => (c as { name: string }).name === col);
}

/** Referral program tables and columns. Safe to run on every start. */
function migrateReferrals(db: DatabaseSync) {
  if (!hasColumn(db, "users", "referral_code")) db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
  if (!hasColumn(db, "users", "referred_by")) {
    db.exec("ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
  }
  if (!hasColumn(db, "orders", "credit_cents")) db.exec("ALTER TABLE orders ADD COLUMN credit_cents INTEGER NOT NULL DEFAULT 0");
  // Price of each line at booking time, so later price changes don't rewrite old orders
  if (!hasColumn(db, "orders", "service_cents")) db.exec("ALTER TABLE orders ADD COLUMN service_cents INTEGER");
  if (!hasColumn(db, "orders", "repair_cents")) db.exec("ALTER TABLE orders ADD COLUMN repair_cents INTEGER");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code ON users(referral_code);
    CREATE TABLE IF NOT EXISTS referral_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact TEXT NOT NULL,
      channel TEXT NOT NULL,
      delivery TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (referrer_id, contact)
    );
    CREATE TABLE IF NOT EXISTS credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      reason TEXT NOT NULL,
      referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS credits_one_reward_per_referral
      ON credits(referred_user_id) WHERE reason = 'referral';
  `);
}

/** Tidy a value pasted into a hosting dashboard: drop stray spaces and wrapping quotes. */
function cleanEnv(v: string | undefined) {
  const t = (v ?? "").trim();
  return t.length >= 2 && /^(["']).*\1$/.test(t) ? t.slice(1, -1).trim() : t;
}

/**
 * OPERATOR_EMAIL / OPERATOR_PASSWORD are the source of truth for the operator login.
 * On every start the account is created if missing, given operator access, and its
 * password reset to OPERATOR_PASSWORD, so changing the variables always takes effect.
 */
function syncOperator(db: DatabaseSync) {
  const email = cleanEnv(process.env.OPERATOR_EMAIL).toLowerCase();
  const pass = cleanEnv(process.env.OPERATOR_PASSWORD);
  if (!email || !pass) {
    console.warn("[auth] OPERATOR_EMAIL / OPERATOR_PASSWORD not set: no operator login is available.");
    return;
  }
  const u = db.prepare("SELECT id, password_hash, role FROM users WHERE email = ?").get(email) as
    | { id: number; password_hash: string; role: string }
    | undefined;
  if (!u) {
    db.prepare(
      "INSERT INTO users (email, password_hash, name, role, reminders_opt_in) VALUES (?, ?, ?, 'operator', 0)"
    ).run(email, bcrypt.hashSync(pass, 10), "Operator");
    console.log(`[auth] Created operator account ${email}`);
    return;
  }
  if (u.role !== "operator" || !bcrypt.compareSync(pass, u.password_hash)) {
    db.prepare("UPDATE users SET role = 'operator', password_hash = ? WHERE id = ?").run(bcrypt.hashSync(pass, 10), u.id);
    console.log(`[auth] Updated operator account ${email} to match OPERATOR_EMAIL / OPERATOR_PASSWORD`);
  }
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
  credit_cents: number;
  created_at: string;
  service_cents: number | null;
  repair_cents: number | null;
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
