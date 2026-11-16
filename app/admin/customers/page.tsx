import { all } from "@/lib/db";
import { fmtDate } from "@/lib/services";

type Row = {
  id: number; name: string; email: string; phone: string; address: string;
  reminders_opt_in: number; next_trip_date: string | null; orders: number; gear: string | null;
};

export default async function Customers() {
  const rows = all<Row>(`
    SELECT u.id, u.name, u.email, u.phone, u.address, u.reminders_opt_in, u.next_trip_date,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS orders,
      (SELECT GROUP_CONCAT(e.description, ' | ') FROM equipment e WHERE e.user_id = u.id) AS gear
    FROM users u WHERE u.role = 'customer' ORDER BY u.name`);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Customers <span className="muted" style={{ fontSize: "1rem" }}>({rows.length})</span></h1>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>Gear</th><th>Next trip</th><th>Orders</th><th>Reminders</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No customers yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name}</strong></td>
                <td><a href={`mailto:${r.email}`}>{r.email}</a><div><a href={`tel:${r.phone}`}>{r.phone}</a></div></td>
                <td>{r.address}</td>
                <td>{r.gear?.split(" | ").map((g) => <div key={g}>{g}</div>)}</td>
                <td>{fmtDate(r.next_trip_date)}</td>
                <td>{r.orders}</td>
                <td>{r.reminders_opt_in ? "Weekly" : "Off"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
