/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { pastWinners, PIC_PRIZE, PIC_WHY_MAX } from "@/lib/pics";
import { mediaUrl } from "@/lib/media";
import { fmtDate } from "@/lib/services";
import PicForm from "./PicForm";

export const metadata: Metadata = { title: "Pic of the week · Edge RX" };

export default async function PicOfTheWeek() {
  const user = await currentUser();
  const winners = pastWinners();
  return (
    <main className="page container stack">
      <h1>Pic of the week</h1>
      <div className="grid-2">
        <div className="card">
          <h2>Enter the contest</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Send us your best shot from the mountain. Each week we pick a winner: their pic goes up on our homepage and they get a{" "}
            <strong>{PIC_PRIZE}</strong>.
          </p>
          {user?.role === "customer" ? (
            <PicForm defaultName={user.name.split(" ")[0]} max={PIC_WHY_MAX} />
          ) : user ? (
            <p className="muted">Log in with a customer account to enter.</p>
          ) : (
            <p><Link href="/login?next=/pic-of-the-week" className="btn accent">Log in to enter</Link> <Link href="/signup?next=/pic-of-the-week">or create an account</Link></p>
          )}
        </div>
        <div>
          <h2>Winners</h2>
          {winners.length === 0 ? <p className="muted">No winners yet. Be the first!</p> : (
            <div className="winners">
              {winners.map((w) => (
                <figure key={w.id}>
                  <img src={mediaUrl(w.image_id)!} alt={`${w.place} by ${w.name}`} loading="lazy" />
                  <figcaption><strong>{w.name}</strong> · {w.place}{w.won_at ? <span className="muted"> · {fmtDate(w.won_at.slice(0, 10))}</span> : null}<br /><em>&ldquo;{w.why}&rdquo;</em></figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
