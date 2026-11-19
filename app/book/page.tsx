import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, type Equipment } from "@/lib/db";
import { addDays, todayISO, money, NOTICE_DAYS } from "@/lib/services";
import { unavailableDates } from "@/lib/capacity";
import { activeProducts } from "@/lib/shop";
import { getPrices, getServicePhotos } from "@/lib/pricing";
import { mediaUrl } from "@/lib/media";
import { earlySeasonActive, earlySeasonEnd } from "@/lib/site";
import BookForm from "./BookForm";
import { creditBalance } from "@/lib/referrals";

export default async function Book({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/book${service ? `?service=${service}` : ""}`)}`);
  if (user.role === "operator") redirect("/admin");
  if (service === "lesson") redirect("/book/learn");
  const gear = all<Equipment>("SELECT * FROM equipment WHERE user_id = ? ORDER BY owner_name, id DESC", user.id);
  const racers = all<{ id: number; name: string; age: number; team: string }>("SELECT id, name, age, team FROM racers WHERE user_id = ? ORDER BY name", user.id);
  const minPickup = addDays(todayISO(), NOTICE_DAYS);
  const credit = creditBalance(user.id);
  return (
    <main className="page container">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1>Schedule a pickup</h1>
        <p className="muted">
          We&apos;ll pick up from <strong>{user.address}</strong>
          {user.pickup_spot ? <> ({user.pickup_spot})</> : null} and call <strong>{user.phone}</strong> if we need anything.{" "}
          <Link href="/account#details">Change</Link>
        </p>
        <div className={user.pickup_spot ? "notice" : "error"}>
          {user.pickup_spot ? (
            <>Please leave your gear in an accessible place on pickup day: <strong>{user.pickup_spot}</strong>. We need to reach it without anyone home.</>
          ) : (
            <>Tell us where you&apos;ll leave your gear (front porch, side yard, garage…) on <Link href="/account#details">your account</Link>. It needs to be somewhere we can reach without anyone home.</>
          )}
        </div>
        {credit > 0 && (
          <div className="notice">You have {money(credit)} in credit. It comes off this booking automatically.</div>
        )}
        <BookForm
          gear={gear}
          initialService={service === "race" ? "race" : "basic"}
          minPickup={minPickup}
          tripDate={user.next_trip_date}
          unavailable={unavailableDates(minPickup)}
          prices={getPrices()}
          racers={racers}
          earlySeasonEnd={earlySeasonActive() ? earlySeasonEnd() : null}
          photos={Object.fromEntries(Object.entries(getServicePhotos()).map(([k, v]) => [k, mediaUrl(v)])) as Record<"basic" | "race" | "repair", string | null>}
          products={activeProducts().map(({ id, name, description, price_cents, stock, image_id }) => ({ id, name, description, price_cents, stock, image: mediaUrl(image_id) }))}
        />
        <p className="muted" style={{ marginTop: 20 }}>
          Want to learn to do it yourself? <Link href="/book/learn">Book a Learn to Tune session</Link>.
        </p>
      </div>
    </main>
  );
}
