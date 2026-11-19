import { all } from "@/lib/db";
import { fmtDate, money, LESSON } from "@/lib/services";
import { setLessonStatus } from "@/app/site-actions";

type Row = { id: number; date: string; time_pref: string; people: number; notes: string; price_cents: number; status: string; payment_status: string; name: string; phone: string; email: string; address: string };
const STATUS = ["requested", "confirmed", "done", "cancelled"];

export default function Lessons() {
  const rows = all<Row>(`SELECT l.*, u.name, u.phone, u.email, u.address FROM lessons l JOIN users u ON u.id = l.user_id
    ORDER BY CASE WHEN l.status IN ('requested','confirmed') THEN 0 ELSE 1 END, l.date`);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{LESSON.name}s</h1>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>People</th><th>Notes</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No sessions booked yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}><strong>{fmtDate(r.date)}</strong><div className="muted">{r.time_pref}</div></td>
                <td><strong>{r.name}</strong><div className="muted">{r.phone}</div><div className="muted" style={{ maxWidth: 220 }}>{r.address}</div></td>
                <td>{r.people}</td>
                <td style={{ maxWidth: 260 }}>{r.notes}</td>
                <td>
                  <form key={`${r.id}-${r.status}`} action={setLessonStatus} className="inline-form">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} aria-label="Status">{STATUS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
                    <button className="btn sm">Save</button>
                  </form>
                </td>
                <td>
                  <form action={setLessonStatus} className="inline-form">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="paid" value={r.payment_status === "paid" ? "0" : "1"} />
                    <span>{money(r.price_cents)}</span>
                    <button className={`btn sm ${r.payment_status === "paid" ? "light" : "ghost"}`}>{r.payment_status === "paid" ? "Paid ✓" : "Mark paid"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
