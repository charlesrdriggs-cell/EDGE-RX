import Link from "next/link";
import { getPrices, getServicePhotos } from "@/lib/pricing";
import { mediaUrl } from "@/lib/media";
import PhotoUpload from "@/app/components/PhotoUpload";
import { SERVICES, BASE_REPAIR, LESSON, SKIFAST, DEFAULT_PRICES, money } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { savePrices } from "@/app/actions";

const dollars = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));

export default async function Prices() {
  const p = getPrices();
  const photos = getServicePhotos();
  const rows = [
    { key: "basic", label: SERVICES.basic.name, cents: p.basic, def: DEFAULT_PRICES.basic },
    { key: "race", label: SERVICES.race.name, cents: p.race, def: DEFAULT_PRICES.race },
    { key: "repair", label: `${BASE_REPAIR.name} (add-on)`, cents: p.repair, def: DEFAULT_PRICES.repair },
    { key: "lesson", label: `${LESSON.name} (${LESSON.length})`, cents: p.lesson, def: DEFAULT_PRICES.lesson },
    { key: "skifast", label: `${SKIFAST.name} (racer price for a ${SERVICES.race.name})`, cents: p.skifast, def: DEFAULT_PRICES.skifast },
  ];
  const photoRows = rows.filter((r) => r.key !== "skifast");
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>Services: prices &amp; photos</h1>
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
      <div className="card">
        <h2>Service photos</h2>
        <p className="muted" style={{ marginTop: 0 }}>Shown on the homepage service cards and the booking form.</p>
        {photoRows.map((r) => (
          <PhotoUpload
            key={`${r.key}-${photos[r.key as keyof typeof photos] ?? "none"}`}
            target={`service:${r.key}`}
            current={mediaUrl(photos[r.key as keyof typeof photos])}
            label={r.label}
          />
        ))}
      </div>
    </div>
  );
}
