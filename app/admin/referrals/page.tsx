import { all } from "@/lib/db";
import { money, fmtDate } from "@/lib/services";
import { REFERRAL_REWARD_CENTS, normalizePhone } from "@/lib/referrals";
import { smsEnabled } from "@/lib/sms";
import { adjustCredit } from "@/app/referral-actions";

type Referred = {
  id: number; name: string; created_at: string; referrer: string; referrer_id: number;
  rewarded_at: string | null; orders: number;
};
type Invite = { id: number; referrer_id: number; referrer: string; contact: string; channel: string; delivery: string; created_at: string };
type Ledger = { id: number; name: string; amount_cents: number; reason: string; note: string; order_id: number | null; created_at: string };
type Customer = { id: number; name: string; email: string };

const REASON: Record<string, string> = {
  referral: "Referral reward", order: "Used on order", refund: "Returned (order cancelled)", adjustment: "Manual adjustment",
};

export default async function Referrals() {
  const referred = all<Referred>(`
    SELECT u.id, u.name, u.created_at, r.name AS referrer, r.id AS referrer_id,
      (SELECT c.created_at FROM credits c WHERE c.referred_user_id = u.id AND c.reason = 'referral') AS rewarded_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS orders
    FROM users u JOIN users r ON r.id = u.referred_by ORDER BY u.id DESC`);
  const invites = all<Invite>(`
    SELECT i.id, i.referrer_id, r.name AS referrer, i.contact, i.channel, i.delivery, i.created_at
    FROM referral_invites i JOIN users r ON r.id = i.referrer_id ORDER BY i.id DESC LIMIT 200`);
  const joinedKeys = new Set(
    all<{ referred_by: number; email: string; phone: string }>("SELECT referred_by, email, phone FROM users WHERE referred_by IS NOT NULL")
      .flatMap((u) => [`${u.referred_by}:${u.email.toLowerCase()}`, `${u.referred_by}:${normalizePhone(u.phone)}`])
  );
  const ledger = all<Ledger>(`
    SELECT c.id, u.name, c.amount_cents, c.reason, c.note, c.order_id, c.created_at
    FROM credits c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC LIMIT 200`);
  const customers = all<Customer>("SELECT id, name, email FROM users WHERE role = 'customer' ORDER BY name");
  const outstanding = all<{ total: number }>("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM credits")[0].total;

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Referrals</h1>
      <p className="muted" style={{ margin: 0 }}>
        Customers earn {money(REFERRAL_REWARD_CENTS)} credit when someone they referred has their first tune picked up (or paid for).
        Unused credit across all customers: <strong>{money(outstanding)}</strong>.
        {!smsEnabled() && " Text invites aren't sent automatically until Twilio is set up; customers are offered a link to text from their own phone."}
      </p>

      <div className="card">
        <h2>Referred customers ({referred.length})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Referred by</th><th>Joined</th><th>Orders</th><th>Reward</th></tr></thead>
            <tbody>
              {referred.length === 0 && <tr><td colSpan={5} className="muted">No referred customers yet.</td></tr>}
              {referred.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.referrer}</td>
                  <td>{fmtDate(r.created_at.slice(0, 10))}</td>
                  <td>{r.orders}</td>
                  <td>{r.rewarded_at ? `${money(REFERRAL_REWARD_CENTS)} given ${fmtDate(r.rewarded_at.slice(0, 10))}` : <span className="muted">Waiting for first tune</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Credit history</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When (UTC)</th><th>Customer</th><th>What</th><th>Amount</th></tr></thead>
              <tbody>
                {ledger.length === 0 && <tr><td colSpan={4} className="muted">No credit activity yet.</td></tr>}
                {ledger.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{c.created_at}</td>
                    <td>{c.name}</td>
                    <td>{REASON[c.reason] ?? c.reason}{c.note && <div className="muted">{c.note}</div>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{c.amount_cents < 0 ? "−" : "+"}{money(Math.abs(c.amount_cents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Adjust credit</h2>
          <p className="muted">Add goodwill credit or fix a mistake. Use a negative amount to remove credit.</p>
          <form action={adjustCredit}>
            <div className="field">
              <label>Customer</label>
              <select name="user_id" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field"><label>Amount ($)</label><input name="amount" inputMode="decimal" placeholder="10 or -10" required /></div>
              <div className="field"><label>Note</label><input name="note" placeholder="Why" /></div>
            </div>
            <button className="btn accent" style={{ width: "100%" }}>Save adjustment</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Invites sent</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>From</th><th>To</th><th>By</th><th>Delivery</th></tr></thead>
            <tbody>
              {invites.length === 0 && <tr><td colSpan={5} className="muted">No invites yet.</td></tr>}
              {invites.map((i) => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{i.created_at}</td>
                  <td>{i.referrer}</td>
                  <td>{i.channel === "sms" ? `(${i.contact.slice(0, 3)}) ${i.contact.slice(3, 6)}-${i.contact.slice(6)}` : i.contact}{joinedKeys.has(`${i.referrer_id}:${i.contact}`) ? <span className="badge" style={{ marginLeft: 6 }}>Joined</span> : null}</td>
                  <td>{i.channel === "sms" ? "Text" : "Email"}</td>
                  <td>{i.delivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
