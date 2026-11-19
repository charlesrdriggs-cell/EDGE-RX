import { NextResponse } from "next/server";
import { sendPickupReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Daily job: emails customers whose pickup is tomorrow. Run it once a day in the
 * evening (the GitHub Action does 6 PM Eastern). Safe to call more than once a day:
 * each booking is only reminded once.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite.com/api/cron/daily
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") || url.searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ pickupReminders: await sendPickupReminders() });
}
