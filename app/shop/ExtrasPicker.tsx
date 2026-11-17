"use client";

import { useState } from "react";
import { money } from "@/lib/services";

export type PickerProduct = { id: number; name: string; description: string; price_cents: number; stock: number | null };

/** Quantity steppers for retail items. Submits qty_<id> fields; reports the running total. */
export default function ExtrasPicker({
  products, onTotal,
}: { products: PickerProduct[]; onTotal?: (cents: number) => void }) {
  const [qty, setQty] = useState<Record<number, number>>({});
  const set = (p: PickerProduct, n: number) => {
    const max = Math.min(p.stock ?? 20, 20);
    const next = { ...qty, [p.id]: Math.max(0, Math.min(max, n)) };
    setQty(next);
    onTotal?.(products.reduce((s, x) => s + (next[x.id] ?? 0) * x.price_cents, 0));
  };
  if (products.length === 0) return <p className="muted">Nothing in the shop right now.</p>;
  return (
    <div className="products">
      {products.map((p) => {
        const q = qty[p.id] ?? 0;
        return (
          <div key={p.id} className={`product${q ? " on" : ""}`}>
            <div style={{ flex: 1 }}>
              <strong>{p.name}</strong> · {money(p.price_cents)}
              <div className="muted" style={{ fontSize: "0.88rem" }}>{p.description}</div>
              {p.stock !== null && p.stock <= 5 && <div className="hint">Only {p.stock} left</div>}
            </div>
            <div className="stepper">
              <button type="button" onClick={() => set(p, q - 1)} disabled={q === 0} aria-label={`Fewer ${p.name}`}>−</button>
              <input name={`qty_${p.id}`} value={q} readOnly aria-label={`${p.name} quantity`} />
              <button type="button" onClick={() => set(p, q + 1)} disabled={q >= Math.min(p.stock ?? 20, 20)} aria-label={`More ${p.name}`}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
