import Link from "next/link";
import ActionForm from "@/app/components/ActionForm";
import { signup } from "@/app/actions";

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="page container">
      <div className="narrow card">
        <h1 style={{ fontSize: "1.8rem" }}>Create your account</h1>
        <p className="muted">We use your address and phone for pickup and drop off.</p>
        <ActionForm action={signup} submit="Create account">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field"><label>Full name</label><input name="name" required autoComplete="name" /></div>
          <div className="row">
            <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="email" /></div>
            <div className="field"><label>Phone</label><input name="phone" type="tel" required autoComplete="tel" /></div>
          </div>
          <div className="field"><label>Pickup &amp; drop off address</label><textarea name="address" rows={2} required autoComplete="street-address" /></div>
          <div className="field"><label>Password</label><input name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
          <div className="field">
            <label>Next ski trip <span className="hint">(optional, so we can remind you to book)</span></label>
            <input name="next_trip_date" type="date" />
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
