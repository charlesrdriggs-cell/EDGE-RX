import { NextResponse } from "next/server";
import { sendWeeklyReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Weekly reminder trigger. Call it once a week from any scheduler, e.g.
 *   Vercel Cron, a GitHub Action, cron-job.org, or crontab:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite.com/api/cron/reminders
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") || url.searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendWeeklyReminders();
  return NextResponse.json(result);
}
