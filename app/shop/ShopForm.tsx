"use client";

import { useActionState, useState } from "react";
import { buyItems } from "@/app/shop-actions";
import { money, fmtDate } from "@/lib/services";
import ExtrasPicker, { type PickerProduct } from "./ExtrasPicker";

export default function ShopForm({
  products, tunes, minDate, initialTune,
}: {
  products: PickerProduct[];
  tunes: { id: number; due_date: string; description: string; tag: string }[];
  minDate: string;
  initialTune?: number;
}) {
  const [state, action, pending] = useActionState(buyItems, undefined);
  const [total, setTotal] = useState(0);
  const first = tunes.find((t) => t.id === initialTune) ?? tunes[0];
  const [deliver, setDeliver] = useState(first ? `tune:${first.id}` : "solo");

  return (
    <form action={action} className="card stack">
      {state?.error && <div className="error">{state.error}</div>}
      <div>
        <h2>1. Pick your items</h2>
        <ExtrasPicker products={products} onTotal={setTotal} />
      </div>
      <div>
        <h2>2. Delivery</h2>
        <div className="choices">
          {tunes.map((t) => (
            <label key={t.id} className="choice">
              <input type="radio" name="deliver" value={`tune:${t.id}`} checked={deliver === `tune:${t.id}`} onChange={() => setDeliver(`tune:${t.id}`)} />
              <strong style={{ display: "inline" }}>With tune {t.tag}</strong>
              <div className="muted">{t.description}, returning {fmtDate(t.due_date)}</div>
            </label>
          ))}
          <label className="choice">
            <input type="radio" name="deliver" value="solo" checked={deliver === "solo"} onChange={() => setDeliver("solo")} />
            <strong style={{ display: "inline" }}>Deliver on its own</strong>
            <div className="muted">Free drop off at your address</div>
          </label>
        </div>
        {deliver === "solo" && (
          <div className="field" style={{ marginTop: 12, maxWidth: 260 }}>
            <label>Delivery date</label>
            <input type="date" name="deliver_date" min={minDate} defaultValue={minDate} required />
          </div>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <label>Notes <span className="hint">(optional)</span></label>
          <input name="notes" placeholder="e.g. Leave on the porch" />
        </div>
      </div>
      <div className="total"><span>Total</span><span>{money(total)}</span></div>
      <button className="btn accent" disabled={pending || total === 0} style={{ width: "100%" }}>
        {pending ? "Ordering…" : total === 0 ? "Add an item" : `Order for ${money(total)}`}
      </button>
    </form>
  );
}
