import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all, type Equipment } from "@/lib/db";
import { addDays, todayISO } from "@/lib/services";
import { unavailableDates } from "@/lib/capacity";
import BookForm from "./BookForm";

export default async function Book({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/book${service ? `?service=${service}` : ""}`)}`);
  if (user.role === "operator") redirect("/admin");
  const gear = all<Equipment>("SELECT * FROM equipment WHERE user_id = ? ORDER BY id DESC", user.id);
  const today = todayISO();
  return (
    <main className="page container">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1>Schedule a pickup</h1>
        <p className="muted">
          We&apos;ll pick up from <strong>{user.address}</strong> and call <strong>{user.phone}</strong> if we need anything.{" "}
          <a href="/account">Change</a>
        </p>
        <BookForm
          gear={gear}
          initialService={service === "race" ? "race" : "basic"}
          minPickup={addDays(today, 1)}
          tripDate={user.next_trip_date}
          unavailable={unavailableDates(addDays(today, 1))}
        />
      </div>
    </main>
  );
}
