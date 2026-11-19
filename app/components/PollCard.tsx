import Link from "next/link";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { votedOption, VOTER_COOKIE, type PollResult } from "@/lib/polls";
import { vote } from "@/app/site-actions";

/** Results bars, used on the homepage and the archive. */
export function PollBars({ poll, mine }: { poll: PollResult; mine?: number | null }) {
  const top = Math.max(...poll.options.map((o) => o.votes), 0);
  return (
    <div className="poll-bars">
      {poll.options.map((o) => (
        <div key={o.id} className={`bar ${o.votes === top && top > 0 ? "lead" : ""} ${mine === o.id ? "mine" : ""}`}>
          <i style={{ width: `${o.pct}%` }} />
          <span>{o.label}{mine === o.id ? " ✓" : ""}</span>
          <b>{o.pct}%</b>
        </div>
      ))}
      <div className="hint">{poll.total} vote{poll.total === 1 ? "" : "s"}</div>
    </div>
  );
}

export default async function PollCard({ poll }: { poll: PollResult }) {
  const u = await currentUser();
  const voter = u ? `user:${u.id}` : (await cookies()).get(VOTER_COOKIE)?.value;
  const mine = votedOption(poll.id, voter);
  return (
    <div className="card poll">
      <span className="eyebrow">Poll</span>
      <h3 style={{ marginTop: 8 }}>{poll.question}</h3>
      {mine ? (
        <PollBars poll={poll} mine={mine} />
      ) : (
        <div className="poll-options">
          {poll.options.map((o) => (
            <form key={o.id} action={vote}>
              <input type="hidden" name="poll_id" value={poll.id} />
              <input type="hidden" name="option_id" value={o.id} />
              <button className="btn light" style={{ width: "100%" }}>{o.label}</button>
            </form>
          ))}
        </div>
      )}
      <Link href="/polls" className="more" style={{ display: "inline-block", marginTop: 12 }}>Past polls →</Link>
    </div>
  );
}
