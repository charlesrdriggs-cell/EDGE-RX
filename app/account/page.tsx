import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, tagCode, ORDER_ROW_SQL, type Equipment, type OrderRow } from "@/lib/db";
import { SERVICES, STATUS_LABEL, fmtDate, money } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { updateProfile, addEquipment } from "@/app/actions";

export default async function Account() {
  const u = await requireUser();
  if (u.role === "operator") redirect("/admin");
  const orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.user_id = ? ORDER BY o.pickup_date DESC`, u.id);
  const gear = all<Equipment>("SELECT * FROM equipment WHERE user_id = ? ORDER BY id DESC", u.id);

  return (
    <main className="page container stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Hi, {u.name.split(" ")[0]}</h1>
        <Link href="/book" className="btn accent">Book a tune</Link>
      </div>

      <div className="card">
        <h2>Your bookings</h2>
        {orders.length === 0 ? (
          <p className="muted">No bookings yet. <Link href="/book">Schedule your first pickup</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tag</th><th>Gear</th><th>Service</th><th>Pickup</th><th>Return</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`}>{tagCode(o.id)}</Link></td>
                    <td>{o.description}</td>
                    <td>{SERVICES[o.service].name}</td>
                    <td>{fmtDate(o.pickup_date)}</td>
                    <td>{fmtDate(o.due_date)}</td>
                    <td><span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td>{money(o.price_cents)}{o.payment_status === "paid" ? " ✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Your details</h2>
          <ActionForm action={updateProfile} submit="Save details">
            <div className="field"><label>Email</label><input value={u.email} disabled /></div>
            <div className="field"><label>Full name</label><input name="name" defaultValue={u.name} required /></div>
            <div className="field"><label>Phone</label><input name="phone" type="tel" defaultValue={u.phone} required /></div>
            <div className="field"><label>Pickup &amp; drop off address</label><textarea name="address" rows={2} defaultValue={u.address} required /></div>
            <div className="field"><label>Next ski trip</label><input name="next_trip_date" type="date" defaultValue={u.next_trip_date ?? ""} /></div>
            <div className="field">
              <label style={{ fontWeight: 400 }}><input type="checkbox" name="reminders" defaultChecked={!!u.reminders_opt_in} /> Weekly reminder emails to book a tune</label>
            </div>
          </ActionForm>
        </div>
        <div className="card">
          <h2>Your gear</h2>
          {gear.length === 0 ? <p className="muted">No gear saved yet.</p> : (
            <ul style={{ paddingLeft: 18 }}>
              {gear.map((g) => <li key={g.id}><strong>{g.kind === "snowboard" ? "Snowboard" : "Skis"}:</strong> {g.description}</li>)}
            </ul>
          )}
          <ActionForm action={addEquipment} submit="Add gear">
            <div className="field">
              <label>Type</label>
              <select name="kind"><option value="skis">Skis</option><option value="snowboard">Snowboard</option></select>
            </div>
            <div className="field"><label>Description</label><input name="description" placeholder="Brand, model, length, color" /></div>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
