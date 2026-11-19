import { all, tagCode, ORDER_ROW_SQL, type OrderRow } from "./db";
import { amountDue } from "./referrals";
import { SERVICES } from "./services";

export type Role = "customer" | "operator" | "driver";
export const ROLE_LABEL: Record<Role, string> = { operator: "Admin", driver: "Driver", customer: "Customer" };

/** Where someone lands after logging in. */
export function homeFor(role: string | undefined) {
  if (role === "operator") return "/admin";
  if (role === "driver") return "/driver";
  return "/account";
}

const cleanEnv = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim().toLowerCase();

/** The owner is the OPERATOR_EMAIL account. Only the owner can add or remove other admins. */
export function isOwner(u: { email: string } | null | undefined) {
  const owner = cleanEnv(process.env.OPERATOR_EMAIL);
  return Boolean(u && owner && u.email.toLowerCase() === owner);
}

export type StaffMember = { id: number; name: string; email: string; phone: string; role: Role; created_at: string };

export function staff(): StaffMember[] {
  return all<StaffMember>(
    "SELECT id, name, email, phone, role, created_at FROM users WHERE role IN ('operator','driver') ORDER BY role DESC, name"
  );
}

export function drivers(): StaffMember[] {
  return staff().filter((s) => s.role === "driver");
}

/** Statuses where the gear is with us and still needs to go back. */
export const OUT_FOR_DELIVERY = ["picked_up", "in_progress", "ready"];

export type Stop = {
  key: string;
  kind: "pickup" | "delivery";
  groupId: number;
  date: string;
  customerName: string;
  phone: string;
  address: string;
  pickupSpot: string;
  pieces: { id: number; tag: string; label: string; status: string }[];
  notes: string[];
  driverId: number | null;
  /** Every piece is ready, so the stop can be delivered. */
  readyToDeliver: boolean;
  dueCents: number;
};

/**
 * Open pickups and deliveries on or before `to`, one stop per booking (pieces booked together
 * travel together). Earlier dates are included because a missed stop still needs doing.
 * Pass driverId to see only that driver's stops.
 */
export function openStops(to: string, driverId?: number): Stop[] {
  const rows = all<OrderRow>(
    `${ORDER_ROW_SQL}
     WHERE (o.status = 'scheduled' AND o.pickup_date <= ?)
        OR (o.status IN ('picked_up','in_progress','ready') AND o.due_date <= ?)
     ORDER BY o.id`,
    to, to
  );
  const stops = new Map<string, Stop>();
  for (const o of rows) {
    const kind = o.status === "scheduled" ? "pickup" : "delivery";
    const driver = kind === "pickup" ? o.pickup_driver_id : o.delivery_driver_id;
    if (driverId !== undefined && driver !== driverId) continue;
    const groupId = o.group_id ?? o.id;
    const key = `${kind}-${groupId}`;
    let s = stops.get(key);
    if (!s) {
      s = {
        key, kind, groupId,
        date: kind === "pickup" ? o.pickup_date : o.due_date,
        customerName: o.customer_name, phone: o.customer_phone, address: o.customer_address,
        pickupSpot: o.customer_pickup_spot, pieces: [], notes: [], driverId: driver,
        readyToDeliver: true, dueCents: 0,
      };
      stops.set(key, s);
    }
    s.pieces.push({
      id: o.id, tag: tagCode(o.id), status: o.status,
      label: `${o.kind === "snowboard" ? "Snowboard" : "Skis"}${o.owner_name ? ` (${o.owner_name})` : ""}: ${o.description} · ${SERVICES[o.service].name}`,
    });
    if (o.notes) s.notes.push(o.notes);
    if (o.status !== "ready") s.readyToDeliver = false;
    if (o.payment_status !== "paid") s.dueCents += amountDue(o);
    if (s.driverId === null && driver !== null) s.driverId = driver;
  }
  return [...stops.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "pickup" ? -1 : 1) || a.groupId - b.groupId);
}
