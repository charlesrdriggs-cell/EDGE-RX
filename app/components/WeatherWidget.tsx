"use client";

import { useEffect, useRef, useState } from "react";
import type { Conditions, Place } from "@/lib/weather";

const QUICK = ["Blue Hills Ski Area", "Wachusett Mountain", "Loon Mountain", "Killington", "Sunday River"];
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" });

/**
 * Homepage weather tools.
 *  mode "conditions": search a ski resort, see temps, new snow, base depth and the wax to pick.
 *  mode "forecast":   search any destination (town, resort, airport city) for a 7-day forecast.
 */
export default function WeatherWidget({ mode, resorts }: { mode: "conditions" | "forecast"; resorts: Place[] }) {
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Conditions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kind = mode === "conditions" ? "resort" : "place";

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const t = q.trim();
    if (!t) { setPlaces([]); return; }
    // Resorts filter instantly; anything else asks the geocoder after a short pause
    const local = resorts.filter((r) => `${r.name} ${r.region}`.toLowerCase().includes(t.toLowerCase())).slice(0, 8);
    if (kind === "resort") setPlaces(local);
    if (t.length < 2 || (kind === "resort" && local.length > 0)) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/weather?search=${encodeURIComponent(t)}&kind=${kind}`);
        const j = await res.json();
        if (res.ok) setPlaces(j.places ?? []);
      } catch { /* keep what we have */ }
    }, 350);
  }, [q, kind, resorts]);

  async function pick(p: Place) {
    setOpen(false);
    setQ(p.name);
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ lat: String(p.lat), lon: String(p.lon), name: p.name, region: p.region, elevation: String(p.elevation ?? "") });
      const res = await fetch(`/api/weather?${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load the weather.");
      setData(j);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card weather">
      <div className="weather-search">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && places[0]) { e.preventDefault(); pick(places[0]); } }}
          placeholder={mode === "conditions" ? "Search a ski resort, e.g. Wachusett" : "Where are you headed? e.g. Stowe, VT"}
          aria-label={mode === "conditions" ? "Search ski resorts" : "Search a destination"}
        />
        {open && places.length > 0 && (
          <ul className="weather-results" role="listbox">
            {places.map((p) => (
              <li key={`${p.name}-${p.lat}-${p.lon}`}>
                <button type="button" onClick={() => pick(p)}>
                  <strong>{p.name}</strong> <span className="muted">{p.region}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {mode === "conditions" && !data && !loading && (
        <div className="flex" style={{ gap: 6, marginTop: 10 }}>
          {QUICK.map((n) => {
            const p = resorts.find((r) => r.name === n);
            return p ? <button key={n} type="button" className="btn sm light" onClick={() => pick(p)}>{n.replace(" Ski Area", "").replace(" Mountain", "")}</button> : null;
          })}
        </div>
      )}
      {loading && <p className="muted">Checking the mountain…</p>}
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {data && !loading && mode === "conditions" && (
        <div className="cond">
          <div className="cond-head">
            <div>
              <h3 style={{ margin: 0 }}>{data.place.name}</h3>
              <span className="muted">{data.place.region}{data.place.elevation ? ` · summit ${Math.round(data.place.elevation * 3.281).toLocaleString()} ft` : ""}</span>
            </div>
            <div className="cond-now"><span>{data.now.icon}</span>{data.now.tempF}°F</div>
          </div>
          <div className="cond-grid">
            <div><small>New snow 24h</small><b>{data.snow24In}&quot;</b></div>
            <div><small>Last 7 days</small><b>{data.snow7dIn}&quot;</b></div>
            <div><small>Next 3 days</small><b>{data.next3In}&quot;</b></div>
            <div><small>Snow depth</small><b>{data.snowDepthIn == null ? "—" : `${data.snowDepthIn}"`}</b></div>
            <div><small>Feels like</small><b>{data.now.feelsF}°</b></div>
            <div><small>Wind</small><b>{data.now.windMph}<span className="unit"> mph</span></b></div>
          </div>
          <div className="cond-wax">
            <span>{data.now.summary}. Today&apos;s pick for wax: <strong>{data.wax}</strong></span>
            <a href="/book" className="btn sm accent">Book a {data.wax} wax tune</a>
          </div>
          <p className="hint" style={{ margin: "8px 0 0" }}>Modeled from weather data, not the resort&apos;s own snow report. Check the resort for trail and lift status.</p>
        </div>
      )}

      {data && !loading && mode === "forecast" && (
        <div className="cond">
          <div className="cond-head">
            <div>
              <h3 style={{ margin: 0 }}>{data.place.name}</h3>
              <span className="muted">{data.place.region}</span>
            </div>
            <div className="cond-now"><span>{data.now.icon}</span>{data.now.tempF}°F</div>
          </div>
          <div className="forecast">
            {data.days.map((d) => (
              <div key={d.date} title={d.summary}>
                <small>{day(d.date)}</small>
                <span className="ico">{d.icon}</span>
                <b>{d.hi}°</b><span className="muted">{d.lo}°</span>
                <span className="snow">{d.snowIn > 0 ? `❄ ${d.snowIn}"` : d.precipPct != null ? `${d.precipPct}%` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
