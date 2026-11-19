import { getCharity, earlySeasonEnd, getSetting } from "@/lib/site";
import ActionForm from "@/app/components/ActionForm";
import { saveSiteSettings } from "@/app/site-actions";

export default function SiteSettings() {
  const c = getCharity();
  const dollars = c.totalCents ? (c.totalCents % 100 ? (c.totalCents / 100).toFixed(2) : String(c.totalCents / 100)) : "";
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>Homepage &amp; promotions</h1>
      <div className="card">
        <ActionForm action={saveSiteSettings} submit="Save">
          <h2>Charity notice</h2>
          <p className="muted" style={{ marginTop: 0 }}>Shown under the homepage banner and on the About page.</p>
          <div className="field"><label>Charity name</label><input name="charity_name" defaultValue={c.name} maxLength={80} /></div>
          <div className="field"><label>Charity website <span className="hint">(optional link)</span></label><input name="charity_url" type="url" defaultValue={c.url} placeholder="https://" /></div>
          <div className="row">
            <div className="field">
              <label>Total donated</label>
              <div className="flex" style={{ gap: 6, flexWrap: "nowrap" }}><span style={{ fontWeight: 700 }}>$</span><input name="charity_total" inputMode="decimal" defaultValue={dollars} placeholder="0" /></div>
            </div>
            <div className="field"><label>As of</label><input name="charity_as_of" type="date" defaultValue={c.asOf ?? ""} /></div>
          </div>
          <p className="hint" style={{ marginTop: -6 }}>Leave the total blank to show the notice without a dollar amount.</p>

          <h2 style={{ marginTop: 24 }}>Early season: tune 3, get 1 free</h2>
          <div className="field">
            <label>Promotion ends <span className="hint">(pickups on or before this date qualify)</span></label>
            <input name="promo_early_end" type="date" defaultValue={getSetting("promo_early_end") ?? earlySeasonEnd()} />
          </div>
          <p className="hint" style={{ marginTop: -6 }}>The #SKIFAST and Learn to Tune prices are under Services &amp; prices.</p>
        </ActionForm>
      </div>
    </div>
  );
}
