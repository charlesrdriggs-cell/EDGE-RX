import Link from "next/link";
import { cookies } from "next/headers";
import ActionForm from "@/app/components/ActionForm";
import { signup } from "@/app/actions";
import { findReferrerByCode, REF_COOKIE, REFERRAL_REWARD_CENTS } from "@/lib/referrals";
import { money } from "@/lib/services";

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string }> }) {
  const { next, ref } = await searchParams;
  const code = (ref || (await cookies()).get(REF_COOKIE)?.value || "").toUpperCase();
  const referrer = code ? findReferrerByCode(code) : undefined;
  return (
    <main className="page container">
      <div className="narrow card">
        <h1 style={{ fontSize: "1.8rem" }}>Create your account</h1>
        {referrer && (
          <div className="notice">
            {referrer.name.split(" ")[0]} invited you. Once your first tune is picked up, they get {money(REFERRAL_REWARD_CENTS)} off their next one.
          </div>
        )}
        <p className="muted">We use your address and phone for pickup and drop off.</p>
        <ActionForm action={signup} submit="Create account">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field"><label>Full name</label><input name="name" required autoComplete="name" /></div>
          <div className="row">
            <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="email" /></div>
            <div className="field"><label>Phone</label><input name="phone" type="tel" required autoComplete="tel" /></div>
          </div>
          <div className="field"><label>Pickup &amp; drop off address</label><textarea name="address" rows={2} required autoComplete="street-address" /></div>
          <div className="field">
            <label>Where should we pick up your gear?</label>
            <input name="pickup_spot" placeholder="Front porch, side yard, garage…" maxLength={200} />
            <div className="hint" style={{ marginTop: 6 }}>Leave gear in an accessible place we can reach without anyone home.</div>
          </div>
          <div className="field"><label>Password</label><input name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
          <div className="field">
            <label>Next ski trip <span className="hint">(optional, so we can remind you to book)</span></label>
            <input name="next_trip_date" type="date" />
          </div>
          <div className="field">
            <label>Referral code <span className="hint">(optional, from the friend who sent you)</span></label>
            <input name="ref" defaultValue={referrer ? code : ""} autoComplete="off" style={{ textTransform: "uppercase" }} />
          </div>
          <div className="field">
            <label style={{ fontWeight: 400 }}><input type="checkbox" name="reminders" defaultChecked /> Send me a weekly reminder to schedule a tune before upcoming trips</label>
          </div>
        </ActionForm>
        <p className="muted" style={{ marginTop: 16 }}>Already have an account? <Link href={`/login${next ? `?next=${next}` : ""}`}>Log in</Link></p>
      </div>
    </main>
  );
}
