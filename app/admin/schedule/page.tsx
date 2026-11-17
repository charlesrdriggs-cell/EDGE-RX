import { all } from "@/lib/db";
import { blockedDates, dailyCapacity } from "@/lib/capacity";
import { addDays, fmtDate, todayISO } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { saveCapacity, addBlockedDate, removeBlockedDate } from "@/app/actions";

export default async function Schedule() {
  const today = todayISO();
  const cap = dailyCapacity();
  const blocked = blockedDates(today);
  const blockedMap = new Map(blocked.map((b) => [b.date, b.reason]));
  const counts = new Map(
    all<{ d: string; n: number }>(
      "SELECT pickup_date d, COUNT(*) n FROM orders WHERE status != 'cancelled' AND pickup_date BETWEEN ? AND ? GROUP BY pickup_date",
      today, addDays(today, 13)
    ).map((r) => [r.d, r.n])
  );
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Pickup schedule</h1>

      <div className="card">
        <h2>Next two weeks</h2>
        <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
          {days.map((d) => {
            const n = counts.get(d) ?? 0;
            const closed = blockedMap.has(d);
            const full = !closed && cap > 0 && n >= cap;
            return (
              <div key={d} className="card" style={{
                padding: 12,
                background: closed ? "#eef1f4" : full ? "#fdecea" : "#fff",
              }}>
                <div style={{ fontWeight: 700 }}>{fmtDate(d)}</div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {closed ? `Closed${blockedMap.get(d) ? `: ${blockedMap.get(d)}` : ""}` : `${n}${cap ? ` / ${cap}` : ""} pickups${full ? " · Full" : ""}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Daily pickup limit</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Once a day has this many bookings, customers can&apos;t choose it for pickup. Use 0 for no limit.
          </p>
          <ActionForm action={saveCapacity} submit="Save limit">
            <div className="field">
              <label>Max pickups per day</label>
              <input name="daily_capacity" type="number" min={0} max={500} defaultValue={cap} required />
            </div>
          </ActionForm>
        </div>

        <div className="card">
          <h2>Block off dates</h2>
          <p className="muted" style={{ marginTop: 0 }}>No pickups on these days (vacations, race weekends, holidays).</p>
          <ActionForm action={addBlockedDate} submit="Block dates">
            <div className="row">
              <div className="field"><label>From</label><input name="from" type="date" min={today} required /></div>
              <div className="field"><label>To <span className="hint">(optional)</span></label><input name="to" type="date" min={today} /></div>
            </div>
            <div className="field"><label>Reason <span className="hint">(shown to customers)</span></label><input name="reason" placeholder="e.g. Away racing" /></div>
          </ActionForm>
          {blocked.length > 0 && (
            <table style={{ marginTop: 16 }}>
              <tbody>
                {blocked.map((b) => (
                  <tr key={b.date}>
                    <td>{fmtDate(b.date, true)}</td>
                    <td className="muted">{b.reason}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={removeBlockedDate}>
                        <input type="hidden" name="date" value={b.date} />
                        <button className="btn sm ghost">Unblock</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
