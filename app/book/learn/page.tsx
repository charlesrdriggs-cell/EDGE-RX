import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { addDays, todayISO, money, LESSON, NOTICE_DAYS } from "@/lib/services";
import { getPrices } from "@/lib/pricing";
import { LESSON_TIMES } from "@/lib/site";
import ActionForm from "@/app/components/ActionForm";
import { bookLesson } from "@/app/site-actions";

export default async function LearnToTune() {
  const user = await currentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent("/book/learn")}`);
  if (user.role === "operator") redirect("/admin/lessons");
  const price = getPrices().lesson;
  const min = addDays(todayISO(), NOTICE_DAYS);
  return (
    <main className="page container">
      <div style={{ maxWidth: 640, margin: "0 auto" }} className="stack">
        <h1>{LESSON.name}</h1>
        <div className="card">
          <div className="flex between">
            <span className="badge accent">{LESSON.length}</span>
            <span className="display" style={{ fontSize: "2.4rem", color: "var(--navy)" }}>{money(price)}</span>
          </div>
          <p>{LESSON.tagline}</p>
          <p className="promo-note" style={{ margin: 0 }}><strong>Pro tip:</strong> {LESSON.proTip}</p>
        </div>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            We&apos;ll come to <strong>{user.address}</strong>. <Link href="/account#details">Change</Link>. Sessions need 48 hours&apos; notice;
            we&apos;ll confirm the start time with you.
          </p>
          <ActionForm action={bookLesson} submit={`Request session · ${money(price)}`}>
            <div className="row">
              <div className="field"><label>Date</label><input type="date" name="date" min={min} defaultValue={min} required /></div>
              <div className="field">
                <label>Time of day</label>
                <select name="time_pref">{LESSON_TIMES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </div>
            <div className="field">
              <label>How many people are learning?</label>
              <input type="number" name="people" min={1} max={10} defaultValue={1} required />
            </div>
            <div className="field">
              <label>Anything we should know? <span className="hint">(optional)</span></label>
              <textarea name="notes" rows={3} placeholder="How many pairs/boards you'd like done, where to set up (garage, basement)…" />
            </div>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
