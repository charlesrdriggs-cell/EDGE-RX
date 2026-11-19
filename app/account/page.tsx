import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, tagCode, ORDER_ROW_SQL, type Equipment, type OrderRow } from "@/lib/db";
import { SERVICES, STATUS_LABEL, LESSON, fmtDate, money } from "@/lib/services";
import ActionForm from "@/app/components/ActionForm";
import { updateProfile, addEquipment, updateEquipment } from "@/app/actions";
import { addRacer, removeRacer, sendSuggestion, cancelLesson } from "@/app/site-actions";
import { rewardsProgress, syncRewards, REWARD_CENTS, REWARD_EVERY_CENTS } from "@/lib/rewards";
import { earlySeasonActive, earlySeasonEnd, SUGGESTION_TOPICS } from "@/lib/site";
import { getPrices } from "@/lib/pricing";
import ReferForm from "./ReferForm";
import {
  amountDue, creditBalance, inviteMessage, referralCode, referralLink, referralStats, REFERRAL_REWARD_CENTS,
} from "@/lib/referrals";
import { shopOrders, shopItems, itemsSummary, shopOrderCode, SHOP_STATUS_LABEL } from "@/lib/shop";

const SPOTS = ["Front porch", "Side yard", "Garage", "Back deck", "Mudroom (door unlocked)"];
type Lesson = { id: number; date: string; time_pref: string; people: number; price_cents: number; status: string; payment_status: string };
type Racer = { id: number; name: string; age: number; team: string };
const LESSON_STATUS: Record<string, string> = { requested: "Requested", confirmed: "Confirmed", done: "Done", cancelled: "Cancelled" };

export default async function Account({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  if (u.role === "operator") redirect("/admin");
  syncRewards(u.id);
  const rewards = rewardsProgress(u.id);
  const lessons = all<Lesson>("SELECT * FROM lessons WHERE user_id = ? ORDER BY date DESC", u.id);
  const racers = all<Racer>("SELECT id, name, age, team FROM racers WHERE user_id = ? ORDER BY name", u.id);
  const prices = getPrices();
  const promoEnd = earlySeasonActive() ? earlySeasonEnd() : null;
  const orders = all<OrderRow>(`${ORDER_ROW_SQL} WHERE o.user_id = ? ORDER BY o.pickup_date DESC`, u.id);
  const retail = shopOrders("s.user_id = ?", u.id).reverse();
  const gear = all<Equipment>("SELECT * FROM equipment WHERE user_id = ? ORDER BY owner_name COLLATE NOCASE, id DESC", u.id);
  const owners = [...new Set(gear.map((g) => g.owner_name || "Unassigned"))];
  const code = referralCode(u.id);
  const balance = creditBalance(u.id);
  const stats = referralStats(u.id);

  return (
    <main className="page container stack">
      <div className="flex between">
        <h1 style={{ margin: 0 }}>Hi, {u.name.split(" ")[0]}</h1>
        <Link href="/book" className="btn accent">Book a tune</Link>
      </div>

      {sp.lesson && <div className="notice">Learn to Tune session requested. We&apos;ll be in touch to confirm the time.</div>}
      {!u.pickup_spot && (
        <div className="error">
          Where should we pick up your gear? Add a pickup spot under <a href="#details">Your details</a> (front porch, side yard, garage…).
        </div>
      )}

      {promoEnd && (
        <div className="promo-banner">
          <div>
            <span className="eyebrow" style={{ color: "#fff" }}>Early season promotion</span>
            <h2 style={{ margin: "4px 0 0" }}>Tune 3, get 1 free</h2>
            <p style={{ margin: "4px 0 0" }}>Book 4 pieces on one pickup by {fmtDate(promoEnd)} and the 4th tune is free. Perfect for the whole family.</p>
          </div>
          <Link href="/book" className="btn">Book the family</Link>
        </div>
      )}

      <div className="card" id="rewards">
        <div className="flex between">
          <h2 style={{ margin: 0 }}>Rewards</h2>
          <span className="badge">{rewards.earned} reward{rewards.earned === 1 ? "" : "s"} earned</span>
        </div>
        <p className="muted">Get {money(REWARD_CENTS)} credit for every {money(REWARD_EVERY_CENTS)} you spend on tunes, sessions and shop items. Credit comes off your next booking automatically.</p>
        <div className="tracker" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rewards.pct} aria-label="Progress to your next reward">
          <i style={{ width: `${Math.max(rewards.pct, 2)}%` }} />
          {[25, 50, 75].map((m) => <span key={m} className="tick" style={{ left: `${m}%` }} />)}
        </div>
        <div className="flex between" style={{ marginTop: 8 }}>
          <span><strong>{money(rewards.into)}</strong> of {money(REWARD_EVERY_CENTS)}</span>
          <span className="muted">{money(rewards.toGo)} to your next {money(REWARD_CENTS)}</span>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Lifetime spend: {money(rewards.spend)}. Tunes count once we pick up your gear (or you pay).</p>
      </div>

      <div className="card">
        <h2>Your bookings</h2>
        {orders.length === 0 ? (
          <p className="muted">No bookings yet. <Link href="/book">Schedule your first pickup</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tag</th><th>Gear</th><th>Service</th><th>Pickup</th><th>Return</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`}>{tagCode(o.id)}</Link></td>
                    <td>{o.owner_name ? <strong>{o.owner_name}: </strong> : null}{o.description}</td>
                    <td>{SERVICES[o.service].name}</td>
                    <td>{fmtDate(o.pickup_date)}</td>
                    <td>{fmtDate(o.due_date)}</td>
                    <td><span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td>{money(amountDue(o))}{o.payment_status === "paid" ? " ✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lessons.length > 0 && (
        <div className="card" id="lessons">
          <h2>{LESSON.name}s</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>People</th><th>Status</th><th>Price</th><th></th></tr></thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id}>
                    <td>{fmtDate(l.date)}</td><td>{l.time_pref}</td><td>{l.people}</td>
                    <td>{LESSON_STATUS[l.status]}</td>
                    <td>{money(l.price_cents)}{l.payment_status === "paid" ? " ✓" : ""}</td>
                    <td>{l.status === "requested" && <form action={cancelLesson}><input type="hidden" name="id" value={l.id} /><button className="btn sm ghost">Cancel</button></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" id="refer">
        <div className="flex between">
          <h2 style={{ margin: 0 }}>Refer a friend, get {money(REFERRAL_REWARD_CENTS)} off</h2>
          <span className="badge">Credit: {money(balance)}</span>
        </div>
        <p className="muted">
          Send friends your link or invite them below. For every new customer who signs up and has their first tune,
          you get {money(REFERRAL_REWARD_CENTS)} off your next booking. Credit comes off automatically when you book.
        </p>
        <div className="grid-2">
          <ReferForm link={referralLink(code)} code={code} shareText={inviteMessage(u, code)} />
          <div>
            <table>
              <tbody>
                <tr><th>Friends invited</th><td>{stats.invited}</td></tr>
                <tr><th>Signed up</th><td>{stats.joined}</td></tr>
                <tr><th>Had their first tune</th><td>{stats.rewarded}</td></tr>
                <tr><th>Credit earned</th><td>{money(stats.earnedCents)}</td></tr>
                <tr><th>Available now</th><td><strong>{money(balance)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {retail.length > 0 && (
        <div className="card">
          <h2>Shop orders</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Items</th><th>Delivery</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {retail.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/shop/orders/${s.id}`}>{shopOrderCode(s.id)}</Link></td>
                    <td>{itemsSummary(shopItems(s.id))}</td>
                    <td>{fmtDate(s.deliver_date)}{s.tune_order_id ? ` with ${tagCode(s.tune_order_id)}` : ""}</td>
                    <td>{SHOP_STATUS_LABEL[s.status]}</td>
                    <td>{money(s.total_cents)}{s.payment_status === "paid" ? " ✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card" id="details">
          <h2>Your details</h2>
          <ActionForm action={updateProfile} submit="Save details">
            <div className="field"><label>Email</label><input value={u.email} disabled /></div>
            <div className="field"><label>Full name</label><input name="name" defaultValue={u.name} required /></div>
            <div className="field"><label>Phone</label><input name="phone" type="tel" defaultValue={u.phone} required /></div>
            <div className="field"><label>Pickup &amp; drop off address</label><textarea name="address" rows={2} defaultValue={u.address} required /></div>
            <div className="field">
              <label>Where should we pick up your gear?</label>
              <input name="pickup_spot" list="spots" defaultValue={u.pickup_spot} placeholder="Front porch, side yard, garage…" required maxLength={200} />
              <datalist id="spots">{SPOTS.map((x) => <option key={x} value={x} />)}</datalist>
              <div className="hint" style={{ marginTop: 6 }}>
                <strong>Please leave gear in an accessible place.</strong> We usually pick up while you&apos;re out, so it needs to be
                somewhere we can reach without anyone home, out of the weather if you can.
              </div>
            </div>
            <div className="row">
              <div className="field"><label>Home mountain</label><input name="home_mountain" defaultValue={u.home_mountain} placeholder="e.g. Wachusett" maxLength={80} /></div>
              <div className="field"><label>Best run</label><input name="best_run" defaultValue={u.best_run} placeholder="e.g. Smith Walton" maxLength={80} /></div>
            </div>
            <div className="field"><label>Next ski trip</label><input name="next_trip_date" type="date" defaultValue={u.next_trip_date ?? ""} /></div>
            <div className="field">
              <label style={{ fontWeight: 400 }}><input type="checkbox" name="reminders" defaultChecked={!!u.reminders_opt_in} /> Weekly reminder emails to book a tune</label>
            </div>
          </ActionForm>
          <p className="hint" style={{ marginBottom: 0 }}>Your home mountain and best run show up (first name only) in the &ldquo;Where Edge RX skis&rdquo; poll on our homepage.</p>
        </div>
        <div className="card" id="gear">
          <h2>Your gear</h2>
          <p className="muted" style={{ marginTop: 0 }}>Add everyone in the household. Each piece gets its own tag with the owner&apos;s name.</p>
          {gear.length === 0 ? <p className="muted">No gear saved yet.</p> : owners.map((owner) => (
            <div key={owner} className="gear-owner">
              <h3>{owner}</h3>
              {gear.filter((g) => (g.owner_name || "Unassigned") === owner).map((g) => (
                <div key={g.id} className="gear-row">
                  <form action={updateEquipment} className="gear-row" style={{ flex: 1, margin: 0 }}>
                    <input type="hidden" name="id" value={g.id} />
                    <span className="kind">{g.kind === "snowboard" ? "🏂" : "⛷️"}</span>
                    <input name="owner_name" defaultValue={g.owner_name} placeholder="Owner" aria-label="Owner" style={{ maxWidth: 120 }} />
                    <input name="description" defaultValue={g.description} aria-label="Description" />
                    <button className="btn sm light">Save</button>
                  </form>
                  <form action={updateEquipment}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="remove" value="1" />
                    <button className="btn sm ghost" title="Remove gear that has never been booked">✕</button>
                  </form>
                </div>
              ))}
            </div>
          ))}
          <h3 style={{ marginTop: 18 }}>Add gear</h3>
          <ActionForm action={addEquipment} submit="Add gear">
            <div className="row">
              <div className="field"><label>Whose gear?</label><input name="owner_name" placeholder="e.g. Jamie" required maxLength={60} /></div>
              <div className="field">
                <label>Type</label>
                <select name="kind"><option value="skis">Skis</option><option value="snowboard">Snowboard</option></select>
              </div>
            </div>
            <div className="field"><label>Description</label><input name="description" placeholder="Brand, model, length, color" /></div>
          </ActionForm>
        </div>
      </div>

      <div className="grid-2">
        <div className="card skifast" id="skifast">
          <span className="badge accent">Ski team promo</span>
          <h2 style={{ marginTop: 10 }}>#SKIFAST · {money(prices.skifast)} race tunes</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Racing for a school or club team? Register each racer and their Performance/Race Day Tune is {money(prices.skifast)}
            {" "}(normally {money(prices.race)}). Pick the racer when you book.
          </p>
          {racers.length > 0 && (
            <table style={{ marginBottom: 14 }}>
              <thead><tr><th>Racer</th><th>Age</th><th>School / team</th><th></th></tr></thead>
              <tbody>
                {racers.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td><td>{r.age}</td><td>{r.team}</td>
                    <td><form action={removeRacer}><input type="hidden" name="id" value={r.id} /><button className="btn sm ghost" title="Remove">✕</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ActionForm action={addRacer} submit="Register racer">
            <div className="row">
              <div className="field"><label>Racer&apos;s name</label><input name="name" required maxLength={60} /></div>
              <div className="field"><label>Age</label><input name="age" type="number" min={4} max={25} required /></div>
            </div>
            <div className="field"><label>School or team</label><input name="team" required maxLength={80} placeholder="e.g. Hingham High Alpine" /></div>
          </ActionForm>
        </div>
        <div className="card" id="suggestions">
          <h2>Suggestions box</h2>
          <p className="muted" style={{ marginTop: 0 }}>Feedback, an idea for a new service, or anything else. It comes straight to us.</p>
          <ActionForm action={sendSuggestion} submit="Send message">
            <div className="field">
              <label>About</label>
              <select name="topic">{SUGGESTION_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field"><label>Message</label><textarea name="message" rows={5} maxLength={2000} required /></div>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
