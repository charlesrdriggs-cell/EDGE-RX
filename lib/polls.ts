import { all, get, run } from "./db";

export type Poll = { id: number; question: string; status: "active" | "archived"; created_at: string; archived_at: string | null };
export type PollOption = { id: number; label: string; votes: number; pct: number; is_other: number };
export type PollResult = Poll & { total: number; options: PollOption[] };
export type WriteIn = { text: string; n: number };

export const VOTER_COOKIE = "voter";
/** Most answers the operator can set on one poll (an "Other" write-in can be added on top). */
export const MAX_POLL_OPTIONS = 5;
export const OTHER_MAX = 80;

export function pollResults(p: Poll): PollResult {
  const options = all<{ id: number; label: string; votes: number; is_other: number }>(
    `SELECT o.id, o.label, o.is_other, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
     FROM poll_options o WHERE o.poll_id = ? ORDER BY o.is_other, o.sort, o.id`,
    p.id
  );
  const total = options.reduce((s, o) => s + o.votes, 0);
  return { ...p, total, options: options.map((o) => ({ ...o, pct: total ? Math.round((o.votes / total) * 100) : 0 })) };
}

/** Customers' own answers on a poll, grouped case-insensitively, most common first. */
export function writeIns(pollId: number, limit = 100): WriteIn[] {
  return all<WriteIn>(
    `SELECT MIN(TRIM(other_text)) AS text, COUNT(*) AS n FROM poll_votes
     WHERE poll_id = ? AND TRIM(other_text) != '' GROUP BY LOWER(TRIM(other_text)) ORDER BY n DESC, text LIMIT ?`,
    pollId, limit
  );
}

/** The poll shown on the homepage: the newest active one. */
export function activePoll(): PollResult | null {
  const p = get<Poll>("SELECT * FROM polls WHERE status = 'active' ORDER BY id DESC LIMIT 1");
  return p ? pollResults(p) : null;
}

export function pollsByStatus(status: "active" | "archived"): PollResult[] {
  return all<Poll>(`SELECT * FROM polls WHERE status = ? ORDER BY ${status === "archived" ? "archived_at DESC," : ""} id DESC`, status).map(pollResults);
}

export function myVote(pollId: number, voter: string | undefined): { optionId: number; otherText: string } | null {
  if (!voter) return null;
  const r = get<{ option_id: number; other_text: string }>("SELECT option_id, other_text FROM poll_votes WHERE poll_id = ? AND voter = ?", pollId, voter);
  return r ? { optionId: r.option_id, otherText: r.other_text } : null;
}

export function votedOption(pollId: number, voter: string | undefined): number | null {
  return myVote(pollId, voter)?.optionId ?? null;
}

export function createPoll(question: string, options: string[], allowOther = false) {
  const id = Number(run("INSERT INTO polls (question) VALUES (?)", question).lastInsertRowid);
  options.forEach((label, i) => run("INSERT INTO poll_options (poll_id, label, sort) VALUES (?, ?, ?)", id, label, i));
  if (allowOther) run("INSERT INTO poll_options (poll_id, label, sort, is_other) VALUES (?, 'Other', ?, 1)", id, options.length);
  return id;
}

/** Records a vote. One per voter per poll; voting again changes the answer. "Other" needs the voter's own answer. */
export function castVote(pollId: number, optionId: number, voter: string, otherText = "") {
  const opt = get<{ is_other: number }>(
    "SELECT o.is_other FROM poll_options o JOIN polls p ON p.id = o.poll_id WHERE o.id = ? AND p.id = ? AND p.status = 'active'", optionId, pollId
  );
  if (!opt) return false;
  const text = opt.is_other ? otherText.trim().replace(/\s+/g, " ").slice(0, OTHER_MAX) : "";
  if (opt.is_other && !text) return false;
  run(
    `INSERT INTO poll_votes (poll_id, option_id, voter, other_text) VALUES (?, ?, ?, ?)
     ON CONFLICT(poll_id, voter) DO UPDATE SET option_id = excluded.option_id, other_text = excluded.other_text, created_at = datetime('now')`,
    pollId, optionId, voter, text
  );
  return true;
}
