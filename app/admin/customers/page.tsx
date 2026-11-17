import { all } from "@/lib/db";
import { fmtDate, money } from "@/lib/services";

type Row = {
  id: number; name: string; email: string; phone: string; address: string;
  reminders_opt_in: number; next_trip_date: string | null; orders: number; gear: string | null;
  referred_by_name: string | null; credit: number;
};

export default async function Customers() {
  const rows = all<Row>(`
    SELECT u.id, u.name, u.email, u.phone, u.address, u.reminders_opt_in, u.next_trip_date,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS orders,
      (SELECT GROUP_CONCAT(e.description, ' | ') FROM equipment e WHERE e.user_id = u.id) AS gear,
      (SELECT r.name FROM users r WHERE r.id = u.referred_by) AS referred_by_name,
      (SELECT COALESCE(SUM(c.amount_cents), 0) FROM credits c WHERE c.user_id = u.id) AS credit
    FROM users u WHERE u.role = 'customer' ORDER BY u.name`);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Customers <span className="muted" style={{ fontSize: "1rem" }}>({rows.length})</span></h1>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>Gear</th><th>Next trip</th><th>Orders</th><th>Reminders</th><th>Referred by</th><th>Credit</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="muted" style={{ padding: 24 }}>No customers yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td><a href={`mailto:${r.email}`}>{r.email}</a><div><a href={`tel:${r.phone}`}>{r.phone}</a></div></td>
                <td>{r.address}</td>
                <td>{r.gear?.split(" | ").map((g) => <div key={g}>{g}</div>)}</td>
                <td>{fmtDate(r.next_trip_date)}</td>
                <td>{r.orders}</td>
                <td>{r.reminders_opt_in ? "Weekly" : "Off"}</td>
                <td>{r.referred_by_name ?? ""}</td>
                <td>{r.credit ? money(r.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
