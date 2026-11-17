import Link from "next/link";
import { getPrices } from "@/lib/pricing";
import { SERVICES, BASE_REPAIR, DEFAULT_PRICES, money } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { savePrices } from "@/app/actions";

const dollars = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));

export default async function Prices() {
  const p = getPrices();
  const rows = [
    { key: "basic", label: SERVICES.basic.name, cents: p.basic, def: DEFAULT_PRICES.basic },
    { key: "race", label: SERVICES.race.name, cents: p.race, def: DEFAULT_PRICES.race },
    { key: "repair", label: `${BASE_REPAIR.name} (add-on)`, cents: p.repair, def: DEFAULT_PRICES.repair },
  ];
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>Tune prices</h1>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Changes show up right away on the homepage, the booking form and reminder emails. Bookings already made keep
          the price they were booked at. Retail item prices are under <Link href="/admin/shop/products">Retail → Products</Link>.
        </p>
        <ActionForm action={savePrices} submit="Save prices">
          {rows.map((r) => (
            <div className="field" key={r.key}>
              <label>
                {r.label} <span className="hint">(default {money(r.def)})</span>
              </label>
              <div className="flex" style={{ gap: 6, flexWrap: "nowrap" }}>
                <span style={{ fontWeight: 700 }}>$</span>
                <input name={r.key} inputMode="decimal" defaultValue={dollars(r.cents)} required style={{ maxWidth: 160 }} />
              </div>
            </div>
          ))}
        </ActionForm>
      </div>
    </div>
  );
}
