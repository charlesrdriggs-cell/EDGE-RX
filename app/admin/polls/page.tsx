import { pollsByStatus, writeIns, MAX_POLL_OPTIONS } from "@/lib/polls";
import { fmtDate } from "@/lib/services";
import { mountainTally } from "@/lib/site";
import ActionForm from "@/app/components/ActionForm";
import { PollBars } from "@/app/components/PollCard";
import { savePoll, setPollStatus } from "@/app/site-actions";

function Actions({ id, archived }: { id: number; archived: boolean }) {
  return (
    <div className="flex" style={{ gap: 6, marginTop: 10 }}>
      <form action={setPollStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value={archived ? "reopen" : "archive"} />
        <button className={`btn sm ${archived ? "light" : ""}`}>{archived ? "Reopen" : "Close & archive"}</button>
      </form>
      <form action={setPollStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value="delete" />
        <button className="btn sm ghost">Delete</button>
      </form>
    </div>
  );
}

export default function AdminPolls() {
  const active = pollsByStatus("active");
  const archived = pollsByStatus("archived");
  const mountains = mountainTally("home_mountain", 20);
  const runs = mountainTally("best_run", 20);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Polls</h1>
      <div className="grid-2">
        <div className="card">
          <h2>New poll</h2>
          <p className="muted" style={{ marginTop: 0 }}>The newest open poll shows on the homepage. Visitors vote once; logged-in customers once per account. Write-in answers show publicly with the results (after someone votes); use Hide to take one down.</p>
          <ActionForm action={savePoll} submit="Publish poll">
            <div className="field"><label>Question</label><input name="question" required maxLength={200} placeholder="What's your favorite wax temp?" /></div>
            <div className="field">
              <label>Answers <span className="hint">(up to {MAX_POLL_OPTIONS}; leave extras blank)</span></label>
              <div style={{ display: "grid", gap: 6 }}>
                {Array.from({ length: MAX_POLL_OPTIONS }, (_, i) => (
                  <input key={i} name="option" placeholder={`Answer ${i + 1}`} maxLength={80} required={i < 1} />
                ))}
              </div>
            </div>
            <div className="field">
              <label style={{ fontWeight: 400 }}><input type="checkbox" name="allow_other" defaultChecked /> Add an &ldquo;Other&rdquo; choice where customers type their own answer</label>
            </div>
          </ActionForm>
        </div>
        <div className="card">
          <h2>Open polls</h2>
          {active.length === 0 && <p className="muted">None. The homepage shows a link to past polls instead.</p>}
          {active.map((p, i) => (
            <div key={p.id} style={{ borderTop: i ? "1px solid var(--line)" : 0, paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
              {i === 0 && <span className="badge accent">On the homepage</span>}
              <h3 style={{ marginTop: 6 }}>{p.question}</h3>
              <PollBars poll={p} writeIns={writeIns(p.id, { includeHidden: true })} manage />
              <Actions id={p.id} archived={false} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Archive ({archived.length})</h2>
        <p className="muted" style={{ marginTop: 0 }}>Shown publicly at /polls.</p>
        <div className="grid-2">
          {archived.map((p) => (
            <div key={p.id}>
              <span className="hint">Closed {p.archived_at ? fmtDate(p.archived_at.slice(0, 10), true) : ""}</span>
              <h3 style={{ marginTop: 4 }}>{p.question}</h3>
              <PollBars poll={p} writeIns={writeIns(p.id, { includeHidden: true })} manage />
              <Actions id={p.id} archived />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Home mountain &amp; best run answers</h2>
        <p className="muted" style={{ marginTop: 0 }}>Collected from customers&apos; account pages. The homepage shows the top home mountains and the newest best runs.</p>
        <div className="grid-2">
          <table><thead><tr><th>Home mountain</th><th>Customers</th></tr></thead>
            <tbody>{mountains.rows.map((m) => <tr key={m.label}><td>{m.label}</td><td>{m.n}</td></tr>)}</tbody></table>
          <table><thead><tr><th>Best run</th><th>Customers</th></tr></thead>
            <tbody>{runs.rows.map((m) => <tr key={m.label}><td>{m.label}</td><td>{m.n}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
