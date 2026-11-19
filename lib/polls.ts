import { all, get, run } from "./db";

export type Poll = { id: number; question: string; status: "active" | "archived"; created_at: string; archived_at: string | null };
export type PollResult = Poll & { total: number; options: { id: number; label: string; votes: number; pct: number }[] };

export const VOTER_COOKIE = "voter";

export function pollResults(p: Poll): PollResult {
  const options = all<{ id: number; label: string; votes: number }>(
    `SELECT o.id, o.label, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
     FROM poll_options o WHERE o.poll_id = ? ORDER BY o.sort, o.id`,
    p.id
  );
  const total = options.reduce((s, o) => s + o.votes, 0);
  return { ...p, total, options: options.map((o) => ({ ...o, pct: total ? Math.round((o.votes / total) * 100) : 0 })) };
}

/** The poll shown on the homepage: the newest active one. */
export function activePoll(): PollResult | null {
  const p = get<Poll>("SELECT * FROM polls WHERE status = 'active' ORDER BY id DESC LIMIT 1");
  return p ? pollResults(p) : null;
}

export function pollsByStatus(status: "active" | "archived"): PollResult[] {
  return all<Poll>(`SELECT * FROM polls WHERE status = ? ORDER BY ${status === "archived" ? "archived_at DESC," : ""} id DESC`, status).map(pollResults);
}

export function votedOption(pollId: number, voter: string | undefined): number | null {
  if (!voter) return null;
  return get<{ option_id: number }>("SELECT option_id FROM poll_votes WHERE poll_id = ? AND voter = ?", pollId, voter)?.option_id ?? null;
}

export function createPoll(question: string, options: string[]) {
  const id = Number(run("INSERT INTO polls (question) VALUES (?)", question).lastInsertRowid);
  options.forEach((label, i) => run("INSERT INTO poll_options (poll_id, label, sort) VALUES (?, ?, ?)", id, label, i));
  return id;
}

/** Records a vote. One per voter per poll; voting again changes the answer. */
export function castVote(pollId: number, optionId: number, voter: string) {
  const ok = get("SELECT o.id FROM poll_options o JOIN polls p ON p.id = o.poll_id WHERE o.id = ? AND p.id = ? AND p.status = 'active'", optionId, pollId);
  if (!ok) return false;
  run(
    `INSERT INTO poll_votes (poll_id, option_id, voter) VALUES (?, ?, ?)
     ON CONFLICT(poll_id, voter) DO UPDATE SET option_id = excluded.option_id, created_at = datetime('now')`,
    pollId, optionId, voter
  );
  return true;
}
