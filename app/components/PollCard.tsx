import Link from "next/link";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { myVote, writeIns as getWriteIns, VOTER_COOKIE, OTHER_MAX, type PollResult, type WriteIn } from "@/lib/polls";
import { vote, toggleWriteIn } from "@/app/site-actions";

/** Results bars, used on the homepage, the archive and the dashboard (which also lists write-ins). */
export function PollBars({ poll, mine, myText, writeIns, manage }: { poll: PollResult; mine?: number | null; myText?: string; writeIns?: WriteIn[]; manage?: boolean }) {
  const top = Math.max(...poll.options.map((o) => o.votes), 0);
  return (
    <div className="poll-bars">
      {poll.options.map((o) => (
        <div key={o.id}>
          <div className={`bar ${o.votes === top && top > 0 ? "lead" : ""} ${mine === o.id ? "mine" : ""}`}>
            <i style={{ width: `${o.pct}%` }} />
            <span>{o.is_other ? "Other (written in)" : o.label}{mine === o.id ? (myText ? `: “${myText}” ✓` : " ✓") : ""}</span>
            <b>{o.pct}%</b>
          </div>
          {!!o.is_other && !!writeIns?.length && (
            <ul className="write-ins">
              {writeIns.map((w) => (
                <li key={w.text} className={w.hidden ? "hidden-answer" : ""}>
                  {w.text}{w.n > 1 && <span className="muted"> ×{w.n}</span>}
                  {manage && (
                    <form action={toggleWriteIn} style={{ display: "inline", marginLeft: 8 }}>
                      <input type="hidden" name="poll_id" value={poll.id} />
                      <input type="hidden" name="text" value={w.text} />
                      <input type="hidden" name="hide" value={w.hidden ? "0" : "1"} />
                      <button className="link-btn">{w.hidden ? "Hidden · show" : "Hide"}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="hint">{poll.total} vote{poll.total === 1 ? "" : "s"}</div>
    </div>
  );
}

export default async function PollCard({ poll }: { poll: PollResult }) {
  const u = await currentUser();
  const voter = u ? `user:${u.id}` : (await cookies()).get(VOTER_COOKIE)?.value;
  const mine = myVote(poll.id, voter);
  const choices = poll.options.filter((o) => !o.is_other);
  const other = poll.options.find((o) => o.is_other);
  return (
    <div className="card poll">
      <span className="eyebrow">Poll</span>
      <h3 style={{ marginTop: 8 }}>{poll.question}</h3>
      {mine ? (
        <PollBars poll={poll} mine={mine.optionId} myText={mine.otherText} writeIns={getWriteIns(poll.id, { limit: 8 })} />
      ) : (
        <div className="poll-options">
          {choices.map((o) => (
            <form key={o.id} action={vote}>
              <input type="hidden" name="poll_id" value={poll.id} />
              <input type="hidden" name="option_id" value={o.id} />
              <button className="btn light" style={{ width: "100%" }}>{o.label}</button>
            </form>
          ))}
          {other && (
            <form action={vote} className="poll-other">
              <input type="hidden" name="poll_id" value={poll.id} />
              <input type="hidden" name="option_id" value={other.id} />
              <input name="other_text" placeholder="Other: type your own answer" maxLength={OTHER_MAX} required aria-label="Your own answer" />
              <button className="btn sm accent">Vote</button>
            </form>
          )}
        </div>
      )}
      <Link href="/polls" className="more" style={{ display: "inline-block", marginTop: 12 }}>Past polls →</Link>
    </div>
  );
}
