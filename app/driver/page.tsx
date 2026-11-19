import Link from "next/link";
import { requireDriver } from "@/lib/auth";
import { openStops } from "@/lib/staff";
import { addDays, fmtDate, money, todayISO } from "@/lib/services";
import { completeStop } from "@/app/staff-actions";

export default async function DriverRoute() {
  const me = await requireDriver();
  const today = todayISO();
  const stops = openStops(addDays(today, 7), me.id);
  const dates = [...new Set(stops.map((s) => s.date))];
  const mapsUrl = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;

  return (
    <main className="page container">
      <div className="stack">
        <div className="flex between">
          <div>
            <h1 style={{ margin: 0 }}>My route</h1>
            <div className="muted">{me.name} · your pickups and deliveries for the next week</div>
          </div>
          {me.role === "operator" && <Link href="/admin/dispatch" className="btn light">Assign drivers</Link>}
        </div>

        {stops.length === 0 && <div className="card muted">No stops assigned to you right now. Check back later.</div>}

        {dates.map((d) => (
          <section key={d} className="stack" style={{ marginTop: 24 }}>
            <h2 style={{ margin: 0 }}>
              {fmtDate(d, true)}
              {d < today && <span className="badge accent" style={{ marginLeft: 8 }}>Overdue</span>}
              {d === today && <span className="badge" style={{ marginLeft: 8 }}>Today</span>}
            </h2>
            {stops.filter((s) => s.date === d).map((s) => (
              <div key={s.key} className="card" style={{ padding: 18 }}>
                <div className="flex between" style={{ alignItems: "flex-start" }}>
                  <div>
                    <span className={`badge ${s.kind === "pickup" ? "" : "accent"}`}>{s.kind === "pickup" ? "Pick up" : "Deliver"}</span>
                    <h3 style={{ margin: "8px 0 2px" }}>{s.customerName}</h3>
                    {s.phone && <div><a href={`tel:${s.phone}`}>{s.phone}</a></div>}
                    {s.address && <div><a href={mapsUrl(s.address)} target="_blank" rel="noreferrer">{s.address}</a></div>}
                    {s.pickupSpot && <div><strong>Gear at:</strong> {s.pickupSpot}</div>}
                  </div>
                  {s.kind === "delivery" && (
                    <div style={{ textAlign: "right" }}>
                      {s.dueCents > 0 ? <><div className="muted">Collect</div><strong style={{ fontSize: "1.3rem" }}>{money(s.dueCents)}</strong></> : <span className="muted">Paid</span>}
                    </div>
                  )}
                </div>
                <div style={{ margin: "12px 0" }}>
                  {s.pieces.map((p) => <div key={p.id}><strong style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{p.tag}</strong> {p.label}</div>)}
                  {s.notes.map((n, i) => <div key={i} className="muted" style={{ fontStyle: "italic" }}>“{n}”</div>)}
                </div>
                {s.kind === "pickup" ? (
                  <form action={completeStop}>
                    <input type="hidden" name="group" value={s.groupId} />
                    <input type="hidden" name="kind" value="pickup" />
                    <button className="btn accent">Picked up {s.pieces.length > 1 ? `all ${s.pieces.length}` : ""}</button>
                  </form>
                ) : s.readyToDeliver ? (
                  <form action={completeStop} className="flex">
                    <input type="hidden" name="group" value={s.groupId} />
                    <input type="hidden" name="kind" value="delivery" />
                    {s.dueCents > 0 && (
                      <label className="flex" style={{ gap: 6 }}>
                        <input type="checkbox" name="collected" value="1" style={{ width: "auto" }} /> I collected {money(s.dueCents)}
                      </label>
                    )}
                    <button className="btn accent">Delivered</button>
                  </form>
                ) : (
                  <div className="muted">Still in the shop. It can be delivered once it&apos;s marked Ready.</div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
