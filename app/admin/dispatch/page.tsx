import Link from "next/link";
import { drivers, openStops, staff, type Stop } from "@/lib/staff";
import { addDays, fmtDate, money, todayISO } from "@/lib/services";
import { assignDriver } from "@/app/staff-actions";

const RANGES = [
  ["Today", 0],
  ["Tomorrow", 1],
  ["Next 7 days", 6],
  ["Next 14 days", 13],
] as const;

export default async function Dispatch({ searchParams }: { searchParams: Promise<{ days?: string; show?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const days = Math.min(60, Math.max(0, Number(sp.days ?? 6) || 0));
  const show = sp.show === "unassigned" ? "unassigned" : "all";
  const to = addDays(today, days);
  const all = openStops(to);
  const stops = show === "unassigned" ? all.filter((s) => s.driverId === null) : all;
  const team = staff();
  const driverList = drivers();
  const unassigned = all.filter((s) => s.driverId === null).length;
  const dates = [...new Set(stops.map((s) => s.date))];
  const qs = (d: number, sh: string) => `/admin/dispatch?days=${d}${sh === "unassigned" ? "&show=unassigned" : ""}`;

  return (
    <div className="stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Assign drivers</h1>
        <Link href="/admin/team" className="btn light">Team &amp; drivers</Link>
      </div>

      {driverList.length === 0 && (
        <div className="notice">No drivers yet. <Link href="/admin/team">Add one on the Team page</Link>. Until then you can assign stops to an admin.</div>
      )}

      <div className="flex" style={{ gap: 6 }}>
        {RANGES.map(([l, d]) => (
          <Link key={l} href={qs(d, show)} className={`btn sm ${d === days ? "" : "light"}`}>{l}</Link>
        ))}
        <span style={{ width: 12 }} />
        <Link href={qs(days, "all")} className={`btn sm ${show === "all" ? "" : "light"}`}>All stops</Link>
        <Link href={qs(days, "unassigned")} className={`btn sm ${show === "unassigned" ? "" : "light"}`}>Unassigned ({unassigned})</Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Open pickups and deliveries through {fmtDate(to, true)}, including any earlier ones not done yet. Pieces booked together are one stop.
      </p>

      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Stop</th><th>Customer</th><th>Gear</th><th>Collect</th><th>Driver</th></tr></thead>
          <tbody>
            {stops.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>Nothing to assign.</td></tr>}
            {dates.map((d) => [
              <tr key={d}><th colSpan={5} style={{ background: "var(--ice)" }}>{fmtDate(d, true)}{d < today ? " · Overdue" : d === today ? " · Today" : ""}</th></tr>,
              ...stops.filter((s) => s.date === d).map((s) => <Row key={s.key} s={s} driverList={driverList} team={team} />),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ s, driverList, team }: {
  s: Stop;
  driverList: { id: number; name: string }[];
  team: { id: number; name: string; role: string }[];
}) {
  const admins = team.filter((p) => p.role === "operator");
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap" }}>
        <strong>{s.kind === "pickup" ? "Pick up" : "Deliver"}</strong>
        {s.kind === "delivery" && !s.readyToDeliver && <div className="muted">Still in the shop</div>}
      </td>
      <td>
        <Link href={`/orders/${s.groupId}`}><strong>{s.customerName}</strong></Link>
        <div className="muted">{s.phone}</div>
        <div className="muted" style={{ maxWidth: 220 }}>{s.address}</div>
        {s.pickupSpot && <div className="muted" style={{ maxWidth: 220 }}>📍 {s.pickupSpot}</div>}
      </td>
      <td style={{ maxWidth: 300 }}>
        {s.pieces.map((p) => <div key={p.id}><strong>{p.tag}</strong> {p.label}</div>)}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>{s.dueCents > 0 ? money(s.dueCents) : <span className="muted">Paid</span>}</td>
      <td>
        <form key={`${s.key}-${s.driverId}`} action={assignDriver} className="inline-form">
          <input type="hidden" name="group" value={s.groupId} />
          <input type="hidden" name="kind" value={s.kind} />
          <select name="driver" defaultValue={s.driverId ?? ""} aria-label="Driver">
            <option value="">Unassigned</option>
            {driverList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            {admins.length > 0 && (
              <optgroup label="Admins">
                {admins.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            )}
          </select>
          <button className="btn sm">Save</button>
        </form>
      </td>
    </tr>
  );
}
