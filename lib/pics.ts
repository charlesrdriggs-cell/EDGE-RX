import { all, get } from "./db";

/** Pic of the week contest. Winners get their photo on the homepage and a $20 DoorDash gift card. */
export const PIC_PRIZE = "$20 DoorDash gift card";
export const PIC_WHY_MAX = 280;
/** Most entries one customer can send in a 7-day window. */
export const PIC_MAX_PER_WEEK = 3;

export type PicSubmission = {
  id: number;
  user_id: number | null;
  image_id: string;
  name: string;
  place: string;
  why: string;
  status: "pending" | "winner" | "declined";
  gift_card_sent: number;
  won_at: string | null;
  created_at: string;
};

export type PicRow = PicSubmission & { email: string | null; account_name: string | null };

export function currentWinner(): PicSubmission | undefined {
  return get<PicSubmission>("SELECT * FROM pic_submissions WHERE status = 'winner' ORDER BY won_at DESC, id DESC LIMIT 1");
}

export function pastWinners(limit = 24): PicSubmission[] {
  return all<PicSubmission>("SELECT * FROM pic_submissions WHERE status = 'winner' ORDER BY won_at DESC, id DESC LIMIT ?", limit);
}

export function submissions(status: PicSubmission["status"]): PicRow[] {
  return all<PicRow>(
    `SELECT p.*, u.email, u.name AS account_name FROM pic_submissions p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.status = ? ORDER BY ${status === "winner" ? "p.won_at DESC" : "p.id DESC"} LIMIT 200`,
    status
  );
}

export function entriesThisWeek(userId: number) {
  return get<{ n: number }>(
    "SELECT COUNT(*) n FROM pic_submissions WHERE user_id = ? AND created_at > datetime('now', '-7 days')", userId
  )?.n ?? 0;
}
