import { all } from "@/lib/db";
import { fmtDate } from "@/lib/services";
import { markSuggestion } from "@/app/site-actions";

type Row = { id: number; topic: string; message: string; is_read: number; created_at: string; name: string | null; email: string | null; phone: string | null };

export default function Suggestions() {
  const rows = all<Row>(`SELECT s.*, u.name, u.email, u.phone FROM suggestions s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.is_read, s.id DESC LIMIT 300`);
  const unread = rows.filter((r) => !r.is_read).length;
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Suggestions</h1>
      <p className="muted" style={{ margin: 0 }}>{unread} new. Messages customers send from their account page. You also get an email for each one.</p>
      {rows.length === 0 && <p className="muted">Nothing yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ borderLeft: r.is_read ? undefined : "6px solid var(--red)" }}>
          <div className="flex between">
            <div><span className="badge">{r.topic}</span> <strong>{r.name ?? "Deleted account"}</strong> <span className="muted">{r.email}{r.phone ? ` · ${r.phone}` : ""}</span></div>
            <span className="hint">{fmtDate(r.created_at.slice(0, 10), true)}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
          <div className="flex" style={{ gap: 6 }}>
            {r.email && <a className="btn sm light" href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: your ${r.topic.toLowerCase()}`)}`}>Reply by email</a>}
            <form action={markSuggestion}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="read" value={r.is_read ? "0" : "1"} />
              <button className="btn sm light">{r.is_read ? "Mark unread" : "Mark read"}</button>
            </form>
            <form action={markSuggestion}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="delete" value="1" />
              <button className="btn sm ghost">Delete</button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
