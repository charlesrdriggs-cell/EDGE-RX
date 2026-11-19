/* eslint-disable @next/next/no-img-element */
import { submissions, PIC_PRIZE } from "@/lib/pics";
import { mediaUrl } from "@/lib/media";
import { fmtDate } from "@/lib/services";
import { judgePic } from "@/app/site-actions";

const Btn = ({ id, action, label, kind = "light" }: { id: number; action: string; label: string; kind?: string }) => (
  <form action={judgePic} style={{ display: "inline" }}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="op" value={action} />
    <button className={`btn sm ${kind}`}>{label}</button>
  </form>
);

export default function AdminPics() {
  const pending = submissions("pending");
  const winners = submissions("winner");
  const declined = submissions("declined");
  const Card = ({ p }: { p: (typeof pending)[number] }) => (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <a href={mediaUrl(p.image_id)!} target="_blank" rel="noopener"><img src={mediaUrl(p.image_id)!} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} /></a>
      <div style={{ padding: 16 }}>
        <strong>{p.name}</strong> · {p.place}
        <div className="hint">{p.account_name ? `${p.account_name} (${p.email})` : "Deleted account"} · {fmtDate(p.created_at.slice(0, 10))}</div>
        <p style={{ fontStyle: "italic" }}>&ldquo;{p.why}&rdquo;</p>
        <div className="flex" style={{ gap: 6 }}>
          {p.status !== "winner" && <Btn id={p.id} action="winner" label="Make pic of the week" kind="accent" />}
          {p.status === "winner" && <Btn id={p.id} action="gift" label={p.gift_card_sent ? "Gift card sent ✓" : "Mark gift card sent"} kind={p.gift_card_sent ? "light" : ""} />}
          {p.status === "pending" && <Btn id={p.id} action="decline" label="Decline" />}
          {p.status !== "pending" && <Btn id={p.id} action="pending" label="Back to pending" />}
          <Btn id={p.id} action="delete" label="Delete" kind="ghost" />
        </div>
      </div>
    </div>
  );
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Pic of the week</h1>
      <p className="muted" style={{ margin: 0 }}>
        The most recent winner shows on the homepage. Making a pic the winner emails the customer that their {PIC_PRIZE} is on the way;
        buy it at doordash.com/gift-cards, send it to their email, then mark it sent here.
      </p>
      <h2>Entries to review ({pending.length})</h2>
      {pending.length === 0 ? <p className="muted">No new entries.</p> : <div className="grid-3">{pending.map((p) => <Card key={p.id} p={p} />)}</div>}
      <h2>Winners ({winners.length})</h2>
      {winners.length === 0 ? <p className="muted">No winners yet.</p> : <div className="grid-3">{winners.map((p) => <Card key={p.id} p={p} />)}</div>}
      {declined.length > 0 && (<><h2>Declined ({declined.length})</h2><div className="grid-3">{declined.map((p) => <Card key={p.id} p={p} />)}</div></>)}
    </div>
  );
}
