import type { Metadata } from "next";
import { pollsByStatus, writeIns } from "@/lib/polls";
import { fmtDate } from "@/lib/services";
import PollCard, { PollBars } from "@/app/components/PollCard";

export const metadata: Metadata = { title: "Polls · Edge RX" };

export default function Polls() {
  const active = pollsByStatus("active");
  const archived = pollsByStatus("archived");
  return (
    <main className="page container stack">
      <h1>Polls</h1>
      {active.length > 0 && (
        <div className="grid-2">{active.map((p) => <PollCard key={p.id} poll={p} />)}</div>
      )}
      <h2>Poll archive</h2>
      {archived.length === 0 ? <p className="muted">No archived polls yet.</p> : (
        <div className="grid-2">
          {archived.map((p) => (
            <div key={p.id} className="card poll">
              <span className="hint">{fmtDate(p.created_at.slice(0, 10), true)}{p.archived_at ? ` to ${fmtDate(p.archived_at.slice(0, 10), true)}` : ""}</span>
              <h3 style={{ marginTop: 6 }}>{p.question}</h3>
              <PollBars poll={p} writeIns={writeIns(p.id, { limit: 12 })} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
