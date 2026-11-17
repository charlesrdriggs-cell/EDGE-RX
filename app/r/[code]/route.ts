import { NextResponse, type NextRequest } from "next/server";
import { findReferrerByCode, REF_COOKIE } from "@/lib/referrals";

/** Shareable referral link: remembers the code for 30 days and sends the visitor to sign up. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referrer = findReferrerByCode(code);
  const url = new URL(referrer ? `/signup?ref=${encodeURIComponent(code.toUpperCase())}` : "/", req.url);
  const res = NextResponse.redirect(url);
  if (referrer) {
    res.cookies.set(REF_COOKIE, code.toUpperCase(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}
