"use client";

import { useActionState, useState } from "react";
import { createOrder } from "@/app/actions";
import type { Equipment } from "@/lib/db";
import {
  SERVICES, BASE_REPAIR, WAX_SPECS, BASE_BEVELS, SIDE_EDGES, SKIFAST, MAX_PIECES, money, orderPrice, addDays, fmtDate,
  type ServiceId, type Prices,
} from "@/lib/services";
import ExtrasPicker, { type PickerProduct } from "@/app/shop/ExtrasPicker";
import BevelInfo from "./BevelInfo";

type Racer = { id: number; name: string; age: number; team: string };
type Piece = { key: number; equip: string; service: ServiceId; wax: string; bevel: string; side: string; repair: boolean; racer: string };
type Photos = Record<"basic" | "race" | "repair", string | null>;

let nextKey = 1;

export default function BookForm({
  gear, initialService, minPickup, tripDate, unavailable, prices, photos, products = [], racers = [], earlySeasonEnd,
}: {
  gear: Equipment[]; initialService: ServiceId; minPickup: string; tripDate: string | null;
  unavailable: Record<string, string>; prices: Prices; photos?: Photos; products?: PickerProduct[];
  racers?: Racer[]; earlySeasonEnd: string | null;
}) {
  let firstOpen = minPickup;
  for (let i = 0; i < 90 && unavailable[firstOpen]; i++) firstOpen = addDays(firstOpen, 1);
  const [state, action, pending] = useActionState(createOrder, undefined);
  const newPiece = (taken: string[], service: ServiceId = initialService): Piece => {
    const free = gear.find((g) => !taken.includes(String(g.id)));
    return { key: nextKey++, equip: free ? String(free.id) : "new", service, wax: "All Season", bevel: "0.7", side: "2", repair: false, racer: "" };
  };
  const [pieces, setPieces] = useState<Piece[]>(() => [newPiece([])]);
  const [extras, setExtras] = useState(0);
  const [pickup, setPickup] = useState(firstOpen);
  // Suggest a return date: the day before the trip if known, else 3 days after pickup
  const suggestedDue = tripDate && tripDate > addDays(firstOpen, 1) ? addDays(tripDate, -1) : addDays(firstOpen, 3);
  const [due, setDue] = useState(suggestedDue);

  const update = (key: number, patch: Partial<Piece>) => setPieces((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const add = () => setPieces((ps) => [...ps, newPiece(ps.map((p) => p.equip), ps[ps.length - 1]?.service)]);
  const remove = (key: number) => setPieces((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps));

  // Mirror the server's pricing so the total is right before submitting
  const linePrices = pieces.map((p) => ({
    key: p.key,
    tune: p.service === "race" && p.racer ? prices.skifast : prices[p.service],
    full: orderPrice(p.service, p.repair, prices, p.service === "race" && !!p.racer),
    repair: p.repair ? prices.repair : 0,
  }));
  const promoOn = !!earlySeasonEnd && pickup <= earlySeasonEnd;
  const freeCount = promoOn ? Math.floor(pieces.length / 4) : 0;
  const freeKeys = new Set([...linePrices].sort((a, b) => a.tune - b.tune).slice(0, freeCount).map((l) => l.key));
  const tunesTotal = linePrices.reduce((s, l) => s + (freeKeys.has(l.key) ? l.repair : l.full), 0);
  const saved = linePrices.reduce((s, l) => s + (freeKeys.has(l.key) ? l.full - l.repair : 0), 0);

  return (
    <form action={action} className="card stack">
      {state?.error && <div className="error">{state.error}</div>}
      <input type="hidden" name="pieces" value={pieces.length} />

      {earlySeasonEnd && (
        <div className="promo-note">
          <strong>Early season: tune 3, get 1 free.</strong> Book 4 pieces for one pickup on or before {fmtDate(earlySeasonEnd)} and the
          4th tune is on us (every 4th piece, the lowest-priced tune is free).
          {pieces.length % 4 === 3 && promoOn && <> Add one more piece to get it free.</>}
        </div>
      )}

      <div>
        <h2>1. Gear &amp; service</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Add every pair of skis and every board going out on this pickup. Each piece gets its own numbered tag.
        </p>
        <div className="stack">
          {pieces.map((p, i) => {
            const otherGear = pieces.filter((x) => x.key !== p.key).map((x) => x.equip);
            const f = (k: string) => `p${i}_${k}`;
            const line = linePrices[i];
            return (
              <fieldset key={p.key} className="piece">
                <legend>
                  Piece {i + 1}{pieces.length > 1 ? ` of ${pieces.length}` : ""}
                  {freeKeys.has(p.key) && <span className="badge accent" style={{ marginLeft: 8 }}>Free tune</span>}
                </legend>
                {pieces.length > 1 && (
                  <button type="button" className="btn sm ghost piece-remove" onClick={() => remove(p.key)}>Remove</button>
                )}

                <div className="field">
                  <label>Gear</label>
                  <select name={f("equipment_id")} value={p.equip === "new" ? "" : p.equip} onChange={(e) => update(p.key, { equip: e.target.value || "new" })}>
                    {gear.map((g) => (
                      <option key={g.id} value={g.id} disabled={otherGear.includes(String(g.id))}>
                        {g.owner_name ? `${g.owner_name}: ` : ""}{g.kind === "snowboard" ? "Snowboard" : "Skis"}, {g.description}
                      </option>
                    ))}
                    <option value="">+ Add new gear</option>
                  </select>
                </div>
                {p.equip === "new" && (
                  <div className="row">
                    <div className="field">
                      <label>Whose gear?</label>
                      <input name={f("new_owner")} placeholder="Skier or rider's name" required />
                    </div>
                    <div className="field">
                      <label>Type</label>
                      <select name={f("new_kind")}><option value="skis">Skis</option><option value="snowboard">Snowboard</option></select>
                    </div>
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label>Description</label>
                      <input name={f("new_description")} placeholder="e.g. Blue Völkl Mantra 177cm" required />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label>Service</label>
                  <div className="choices">
                    {(Object.keys(SERVICES) as ServiceId[]).map((id) => (
                      <label key={id} className="choice">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {i === 0 && photos?.[id] && <img src={photos[id]!} alt="" className="choice-photo" />}
                        <input type="radio" name={f("service")} value={id} checked={p.service === id} onChange={() => update(p.key, { service: id })} />
                        <strong style={{ display: "inline" }}>{SERVICES[id].name}</strong> · {money(prices[id])}
                        <div className="muted" style={{ fontSize: "0.88rem" }}>{SERVICES[id].includes.slice(0, 3).join(", ")}…</div>
                      </label>
                    ))}
                  </div>
                </div>

                {p.service === "basic" ? (
                  <div className="field">
                    <label>Hot wax spec <span className="hint">(match the snow temperature you expect)</span></label>
                    <div className="seg">
                      {WAX_SPECS.map((w) => (
                        <label key={w}><input type="radio" name={f("wax_spec")} value={w} checked={p.wax === w} onChange={() => update(p.key, { wax: w })} />{w}</label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row">
                      <div className="field">
                        <label>Base bevel</label>
                        <div className="seg">
                          {BASE_BEVELS.map((b) => (
                            <label key={b}><input type="radio" name={f("base_bevel")} value={b} checked={p.bevel === b} onChange={() => update(p.key, { bevel: b })} />{b}°</label>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Side edge</label>
                        <div className="seg">
                          {SIDE_EDGES.map((s) => (
                            <label key={s}><input type="radio" name={f("side_edge")} value={s} checked={p.side === s} onChange={() => update(p.key, { side: s })} />{s}°</label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <BevelInfo onPreset={(bevel, side) => update(p.key, { bevel, side })} />
                    <div className="field" style={{ marginTop: 12 }}>
                      <label>#SKIFAST ski team racer <span className="hint">({SKIFAST.name}, {money(prices.skifast)})</span></label>
                      {racers.length > 0 ? (
                        <select name={f("racer_id")} value={p.racer} onChange={(e) => update(p.key, { racer: e.target.value })}>
                          <option value="">Not a #SKIFAST team tune</option>
                          {racers.map((r) => <option key={r.id} value={r.id}>{r.name}, {r.age}, {r.team}</option>)}
                        </select>
                      ) : (
                        <div className="hint">
                          On a ski team? <a href="/account#skifast">Register your racer</a> (name, age, school or team) to get this tune for {money(prices.skifast)}.
                        </div>
                      )}
                    </div>
                  </>
                )}

                <label className="choice" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i === 0 && photos?.repair && <img src={photos.repair} alt="" className="addon-photo" style={{ width: 64, height: 64 }} />}
                  <div style={{ flex: 1 }}>
                    <input type="checkbox" name={f("base_repair")} checked={p.repair} onChange={(e) => update(p.key, { repair: e.target.checked })} />
                    <strong style={{ display: "inline" }}>Add {BASE_REPAIR.name}</strong> · +{money(prices.repair)}
                    <div className="muted" style={{ fontSize: "0.88rem" }}>Fill core shots and gouges in the base.</div>
                  </div>
                </label>
                <div className="piece-total">
                  {freeKeys.has(p.key) ? <><s>{money(line.full)}</s> {money(line.repair)}</> : money(line.full)}
                </div>
              </fieldset>
            );
          })}
        </div>
        {pieces.length < MAX_PIECES && (
          <button type="button" className="btn light" style={{ marginTop: 14 }} onClick={add}>+ Add another pair or board</button>
        )}
      </div>

      <div>
        <h2>2. Dates</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          We need <strong>48 hours&apos; notice</strong> for a pickup, so the earliest pickup is {fmtDate(minPickup)}.
          {tripDate && <> Your next trip is on file for {fmtDate(tripDate)}, so we suggested a return date the day before.</>}
        </p>
        <div className="row">
          <div className="field">
            <label>Pickup date</label>
            <input type="date" name="pickup_date" min={minPickup} value={pickup} required
              onChange={(e) => { setPickup(e.target.value); if (due <= e.target.value) setDue(addDays(e.target.value, 2)); }} />
            {pickup && pickup < minPickup && (
              <div className="error" style={{ marginTop: 8, marginBottom: 0 }}>Pickups need 48 hours&apos; notice. Pick {fmtDate(minPickup)} or later.</div>
            )}
            {unavailable[pickup] && (
              <div className="error" style={{ marginTop: 8, marginBottom: 0 }}>{unavailable[pickup]}. Please pick another day.</div>
            )}
          </div>
          <div className="field">
            <label>Return (due) date</label>
            <input type="date" name="due_date" min={addDays(pickup, 1)} value={due} required onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Notes for the tech <span className="hint">(optional)</span></label>
          <textarea name="notes" rows={2} placeholder="Gate code, problem spots on the base, current bevel if you know it…" />
        </div>
      </div>

      {products.length > 0 && (
        <div>
          <h2>3. Extras <span className="hint">(optional, back with your gear)</span></h2>
          <ExtrasPicker products={products} onTotal={setExtras} />
        </div>
      )}

      {saved > 0 && (
        <div className="flex between" style={{ color: "var(--ok)", fontWeight: 600 }}>
          <span>Early season: {freeCount} free tune{freeCount > 1 ? "s" : ""}</span><span>−{money(saved)}</span>
        </div>
      )}
      <div className="total">
        <span>Total{pieces.length > 1 ? ` · ${pieces.length} pieces` : ""}</span>
        <span>{money(tunesTotal + extras)}</span>
      </div>
      {Object.keys(unavailable).length > 0 && (
        <p className="hint" style={{ margin: 0 }}>
          Unavailable for pickup: {Object.keys(unavailable).sort().slice(0, 8).map((d) => fmtShort(d)).join(", ")}
          {Object.keys(unavailable).length > 8 ? ", …" : ""}
        </p>
      )}
      <button className="btn accent" disabled={pending || !!unavailable[pickup] || pickup < minPickup} style={{ width: "100%" }}>
        {pending ? "Booking…" : `Book pickup${pieces.length > 1 ? ` for ${pieces.length} pieces` : ""}`}
      </button>
    </form>
  );
}

const fmtShort = (d: string) => fmtDate(d).replace(/^\w+, /, "");
