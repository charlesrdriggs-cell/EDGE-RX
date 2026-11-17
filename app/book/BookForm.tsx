"use client";

import { useActionState, useState } from "react";
import { createOrder } from "@/app/actions";
import type { Equipment } from "@/lib/db";
import {
  SERVICES, BASE_REPAIR, WAX_SPECS, BASE_BEVELS, SIDE_EDGES, money, orderPrice, addDays, type ServiceId,
} from "@/lib/services";
import ExtrasPicker, { type PickerProduct } from "@/app/shop/ExtrasPicker";

export default function BookForm({
  gear, initialService, minPickup, tripDate, products = [],
}: { gear: Equipment[]; initialService: ServiceId; minPickup: string; tripDate: string | null; products?: PickerProduct[] }) {
  const [state, action, pending] = useActionState(createOrder, undefined);
  const [service, setService] = useState<ServiceId>(initialService);
  const [repair, setRepair] = useState(false);
  const [extras, setExtras] = useState(0);
  const [equip, setEquip] = useState<string>(gear[0] ? String(gear[0].id) : "new");
  const [pickup, setPickup] = useState(minPickup);
  // Suggest a return date: the day before the trip if known, else 3 days after pickup
  const suggestedDue = tripDate && tripDate > addDays(minPickup, 1) ? addDays(tripDate, -1) : addDays(minPickup, 3);
  const [due, setDue] = useState(suggestedDue);

  return (
    <form action={action} className="card stack">
      {state?.error && <div className="error">{state.error}</div>}

      <div>
        <h2>1. Your gear</h2>
        <div className="choices">
          {gear.map((g) => (
            <label key={g.id} className="choice">
              <input type="radio" name="equipment_id" value={g.id} checked={equip === String(g.id)} onChange={() => setEquip(String(g.id))} />
              <strong style={{ display: "inline" }}>{g.kind === "snowboard" ? "Snowboard" : "Skis"}</strong>
              <div className="muted">{g.description}</div>
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="equipment_id" value="" checked={equip === "new"} onChange={() => setEquip("new")} />
            <strong style={{ display: "inline" }}>Add new gear</strong>
          </label>
        </div>
        {equip === "new" && (
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Type</label>
              <select name="new_kind"><option value="skis">Skis</option><option value="snowboard">Snowboard</option></select>
            </div>
            <div className="field">
              <label>Description</label>
              <input name="new_description" placeholder="e.g. Blue Völkl Mantra 177cm" required />
            </div>
          </div>
        )}
      </div>

      <div>
        <h2>2. Service</h2>
        <div className="choices">
          {(Object.keys(SERVICES) as ServiceId[]).map((id) => (
            <label key={id} className="choice">
              <input type="radio" name="service" value={id} checked={service === id} onChange={() => setService(id)} />
              <strong style={{ display: "inline" }}>{SERVICES[id].name}</strong> · {money(SERVICES[id].priceCents)}
              <div className="muted" style={{ fontSize: "0.88rem" }}>{SERVICES[id].includes.slice(0, 3).join(", ")}…</div>
            </label>
          ))}
        </div>

        {service === "basic" ? (
          <div className="field" style={{ marginTop: 16 }}>
            <label>Hot wax spec <span className="hint">(match the snow temperature you expect)</span></label>
            <div className="seg">
              {WAX_SPECS.map((w, i) => (
                <label key={w}><input type="radio" name="wax_spec" value={w} defaultChecked={i === 1} />{w}</label>
              ))}
            </div>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Base bevel</label>
              <div className="seg">
                {BASE_BEVELS.map((b, i) => (
                  <label key={b}><input type="radio" name="base_bevel" value={b} defaultChecked={i === 0} />{b}°</label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Side edge</label>
              <div className="seg">
                {SIDE_EDGES.map((s, i) => (
                  <label key={s}><input type="radio" name="side_edge" value={s} defaultChecked={i === 2} />{s}°</label>
                ))}
              </div>
            </div>
          </div>
        )}

        <label className="choice" style={{ marginTop: 4 }}>
          <input type="checkbox" name="base_repair" checked={repair} onChange={(e) => setRepair(e.target.checked)} />
          <strong style={{ display: "inline" }}>Add {BASE_REPAIR.name}</strong> · +{money(BASE_REPAIR.priceCents)}
          <div className="muted" style={{ fontSize: "0.88rem" }}>Fill core shots and gouges in the base.</div>
        </label>
      </div>

      <div>
        <h2>3. Dates</h2>
        {tripDate && <p className="muted" style={{ marginTop: 0 }}>Your next trip is on file for {tripDate}. We suggested a return date the day before.</p>}
        <div className="row">
          <div className="field">
            <label>Pickup date</label>
            <input type="date" name="pickup_date" min={minPickup} value={pickup} required
              onChange={(e) => { setPickup(e.target.value); if (due <= e.target.value) setDue(addDays(e.target.value, 2)); }} />
          </div>
          <div className="field">
            <label>Return (due) date</label>
            <input type="date" name="due_date" min={addDays(pickup, 1)} value={due} required onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Notes for the tech <span className="hint">(optional)</span></label>
          <textarea name="notes" rows={2} placeholder="Gate code, where you'll leave the gear, problem spots on the base…" />
        </div>
      </div>

      {products.length > 0 && (
        <div>
          <h2>4. Extras <span className="hint">(optional, back with your gear)</span></h2>
          <ExtrasPicker products={products} onTotal={setExtras} />
        </div>
      )}

      <div className="total">
        <span>Total</span>
        <span>{money(orderPrice(service, repair) + extras)}</span>
      </div>
      <button className="btn accent" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Booking…" : "Book pickup"}
      </button>
    </form>
  );
}
