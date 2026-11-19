import { all } from "@/lib/db";
import { sendRemindersNow, sendPickupRemindersNow, sendTestEmail } from "@/app/actions";
import { emailProviderOn, emailFrom } from "@/lib/email";
import { currentUser } from "@/lib/auth";
import ActionForm from "@/app/components/ActionForm";

type Email = { id: number; to_email: string; subject: string; body: string; kind: string; delivery: string; sent_at: string };

export default async function Reminders({ searchParams }: { searchParams: Promise<{ sent?: string; pickup?: string }> }) {
  const { sent, pickup } = await searchParams;
  const emails = all<Email>("SELECT * FROM emails ORDER BY id DESC LIMIT 100");
  const providerOn = emailProviderOn();
  const me = await currentUser();
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Reminders &amp; emails</h1>
      {sent !== undefined && <div className="notice">Sent {sent} reminder{sent === "1" ? "" : "s"}.</div>}
      <div className="card">
        <h2>Weekly reminders</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every week, customers who opted in and don&apos;t have an open booking get a reminder to schedule a pickup
          (mentioning their next trip date if they gave one). Nobody gets more than one reminder in 6 days.
          A scheduler calls <code>/api/cron/reminders</code> weekly; you can also send them now.
        </p>
        {!providerOn && (
          <p className="error" style={{ fontWeight: 400 }}>
            No email provider is connected yet, so emails are saved below instead of sent. Add a <code>RESEND_API_KEY</code> to send for real.
          </p>
        )}
        <form action={sendRemindersNow}><button className="btn accent">Send reminders now</button></form>
      </div>
      {pickup !== undefined && <div className="notice">Sent {pickup} pickup reminder{pickup === "1" ? "" : "s"} for tomorrow.</div>}
      <div className="card">
        <h2>Pickup reminders</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every evening, customers with a pickup tomorrow get an email asking them to leave their gear out (one email per
          customer, never twice for the same booking). A scheduler calls <code>/api/cron/daily</code>; you can also send
          tomorrow&apos;s now. When you mark an order <strong>Ready</strong>, the customer automatically gets a
          &ldquo;tuned and on its way&rdquo; email with the drop-off date.
        </p>
        <form action={sendPickupRemindersNow}><button className="btn accent">Send tomorrow&apos;s pickup reminders now</button></form>
      </div>
      <div className="card">
        <h2>Email setup</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {providerOn ? (
            <>Connected to Resend. Emails go out from <code>{emailFrom()}</code>.</>
          ) : (
            <>Not connected. Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in Railway to send for real.</>
          )}
        </p>
        <ActionForm action={sendTestEmail} submit="Send test email">
          <div className="field">
            <label htmlFor="test-to">Send a test to</label>
            <input id="test-to" name="to" type="email" defaultValue={me?.email ?? ""} required />
          </div>
        </ActionForm>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>To</th><th>Type</th><th>Subject</th><th>Delivery</th></tr></thead>
            <tbody>
              {emails.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No emails yet.</td></tr>}
              {emails.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{e.sent_at}</td>
                  <td>{e.to_email}</td>
                  <td>{e.kind}</td>
                  <td>
                    <details><summary>{e.subject}</summary><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{e.body}</pre></details>
                  </td>
                  <td>{e.delivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
