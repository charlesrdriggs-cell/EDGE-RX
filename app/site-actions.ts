"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, run, all } from "@/lib/db";
import { requireUser, requireOperator, currentUser } from "@/lib/auth";
import { saveImage, deleteImage } from "@/lib/media";
import { sendEmail, APP_URL, BUSINESS_NAME } from "@/lib/email";
import { setSetting, SUGGESTION_TOPICS, LESSON_TIMES } from "@/lib/site";
import { castVote, createPoll, VOTER_COOKIE } from "@/lib/polls";
import { PIC_WHY_MAX, PIC_MAX_PER_WEEK, entriesThisWeek } from "@/lib/pics";
import { getPrices } from "@/lib/pricing";
import { syncRewards } from "@/lib/rewards";
import { LESSON, NOTICE_DAYS, addDays, fmtDate, money, todayISO } from "@/lib/services";
import type { FormState } from "@/app/actions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const operatorEmail = () => (process.env.OPERATOR_EMAIL ?? "").trim().replace(/^["']|["']$/g, "");

/* ---------- #SKIFAST racers ---------- */

export async function addRacer(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const name = str(fd, "name").slice(0, 60), team = str(fd, "team").slice(0, 80);
  const age = Number(str(fd, "age"));
  if (!name || !team) return { error: "Enter the racer's name and their school or team." };
  if (!Number.isInteger(age) || age < 4 || age > 25) return { error: "Enter the racer's age (4 to 25)." };
  if ((get<{ n: number }>("SELECT COUNT(*) n FROM racers WHERE user_id = ?", u.id)?.n ?? 0) >= 8) {
    return { error: "That's the most racers one account can register. Email us if you need more." };
  }
  run("INSERT INTO racers (user_id, name, age, team) VALUES (?, ?, ?, ?)", u.id, name, age, team);
  revalidatePath("/account");
  return { ok: `${name} is registered for #SKIFAST. Pick them when you book a Performance/Race Day Tune.` };
}

export async function removeRacer(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  // Keep racers that are on an order so the tag history stays readable
  if (!get("SELECT id FROM orders WHERE racer_id = ?", id)) run("DELETE FROM racers WHERE id = ? AND user_id = ?", id, u.id);
  revalidatePath("/account");
}

/* ---------- Suggestions box ---------- */

export async function sendSuggestion(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const topic = SUGGESTION_TOPICS.includes(str(fd, "topic")) ? str(fd, "topic") : "Something else";
  const message = str(fd, "message").slice(0, 2000);
  if (message.length < 3) return { error: "Write a message first." };
  const recent = get<{ n: number }>("SELECT COUNT(*) n FROM suggestions WHERE user_id = ? AND created_at > datetime('now', '-1 day')", u.id)?.n ?? 0;
  if (recent >= 10) return { error: "Thanks for all the ideas! Please try again tomorrow." };
  run("INSERT INTO suggestions (user_id, topic, message) VALUES (?, ?, ?)", u.id, topic, message);
  const to = operatorEmail();
  if (to) {
    await sendEmail({
      userId: null, to, kind: "suggestion",
      subject: `New suggestion from ${u.name}: ${topic}`,
      body: `${u.name} (${u.email}, ${u.phone}) wrote:\n\n${message}\n\nAll suggestions: ${APP_URL}/admin/suggestions`,
    });
  }
  return { ok: "Thanks! Your message went straight to us." };
}

export async function markSuggestion(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  if (fd.get("delete") === "1") run("DELETE FROM suggestions WHERE id = ?", id);
  else run("UPDATE suggestions SET is_read = ? WHERE id = ?", fd.get("read") === "1" ? 1 : 0, id);
  revalidatePath("/admin/suggestions");
}

/* ---------- Learn to Tune sessions ---------- */

export async function bookLesson(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (u.role !== "customer") return { error: "Operator accounts can't book. Log in as a customer." };
  const date = str(fd, "date");
  const time = LESSON_TIMES.includes(str(fd, "time_pref")) ? str(fd, "time_pref") : "";
  const people = Number(str(fd, "people"));
  if (!isDate(date)) return { error: "Pick a date for the session." };
  if (date < addDays(todayISO(), NOTICE_DAYS)) return { error: `We need 48 hours' notice. The earliest date is ${fmtDate(addDays(todayISO(), NOTICE_DAYS))}.` };
  if (get("SELECT date FROM blocked_dates WHERE date = ?", date)) return { error: "We're not available that day. Please pick another." };
  if (!time) return { error: "Pick a time of day." };
  if (!Number.isInteger(people) || people < 1 || people > 10) return { error: "How many people are learning? (1 to 10)" };
  const price = getPrices().lesson;
  const notes = str(fd, "notes").slice(0, 1000);
  const id = Number(run(
    "INSERT INTO lessons (user_id, date, time_pref, people, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?)",
    u.id, date, time, people, notes, price
  ).lastInsertRowid);
  const body = [
    `Hi ${u.name.split(" ")[0]},`, "",
    `Thanks for booking a ${LESSON.name} (${LESSON.length}, ${money(price)}). We'll confirm the exact start time by phone or email.`, "",
    `Date: ${fmtDate(date, true)}, ${time}`,
    `Where: ${u.address}`,
    `People learning: ${people}`,
    ...(notes ? [`Notes: ${notes}`] : []), "",
    `Pro tip: ${LESSON.proTip} Have the family's skis and boards ready.`, "",
    BUSINESS_NAME,
  ].join("\n");
  await sendEmail({ userId: u.id, to: u.email, kind: "lesson", subject: `Learn to Tune requested for ${fmtDate(date)}`, body });
  const to = operatorEmail();
  if (to) {
    await sendEmail({
      userId: null, to, kind: "lesson-operator",
      subject: `New Learn to Tune request: ${u.name}, ${fmtDate(date)}`,
      body: `${u.name} (${u.phone}, ${u.email}) asked for a session on ${fmtDate(date, true)}, ${time}, for ${people}.\nAddress: ${u.address}\n${notes}\n\n${APP_URL}/admin/lessons`,
    });
  }
  redirect(`/account?lesson=${id}#lessons`);
}

export async function cancelLesson(fd: FormData) {
  const u = await requireUser();
  run("UPDATE lessons SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'requested'", Number(fd.get("id")), u.id);
  revalidatePath("/account");
}

export async function setLessonStatus(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const status = str(fd, "status");
  if (["requested", "confirmed", "done", "cancelled"].includes(status)) run("UPDATE lessons SET status = ? WHERE id = ?", status, id);
  const paid = str(fd, "paid");
  if (paid === "1" || paid === "0") run("UPDATE lessons SET payment_status = ? WHERE id = ?", paid === "1" ? "paid" : "unpaid", id);
  syncRewards(get<{ user_id: number }>("SELECT user_id FROM lessons WHERE id = ?", id)?.user_id);
  revalidatePath("/admin/lessons");
}

/* ---------- Polls ---------- */

export async function vote(fd: FormData) {
  const jar = await cookies();
  let voter = jar.get(VOTER_COOKIE)?.value;
  if (!voter || !/^[A-Za-z0-9_-]{16,64}$/.test(voter)) {
    voter = crypto.randomBytes(16).toString("base64url");
    jar.set(VOTER_COOKIE, voter, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  // Logged-in customers vote once per account, whatever device they use
  const u = await currentUser();
  castVote(Number(fd.get("poll_id")), Number(fd.get("option_id")), u ? `user:${u.id}` : voter);
  revalidatePath("/");
}

export async function savePoll(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const question = str(fd, "question").slice(0, 200);
  const options = str(fd, "options").split("\n").map((s) => s.trim().slice(0, 80)).filter(Boolean);
  const unique = [...new Set(options)];
  if (!question) return { error: "Write the question." };
  if (unique.length < 2 || unique.length > 8) return { error: "Give 2 to 8 answers, one per line." };
  createPoll(question, unique);
  revalidatePath("/", "layout");
  return { ok: "Poll is live on the homepage." };
}

export async function setPollStatus(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const action = str(fd, "op");
  if (action === "archive") run("UPDATE polls SET status = 'archived', archived_at = datetime('now') WHERE id = ?", id);
  if (action === "reopen") run("UPDATE polls SET status = 'active', archived_at = NULL WHERE id = ?", id);
  if (action === "delete") run("DELETE FROM polls WHERE id = ?", id);
  revalidatePath("/", "layout");
}

/* ---------- Pic of the week ---------- */

export async function submitPic(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const name = str(fd, "name").slice(0, 60), place = str(fd, "place").slice(0, 80), why = str(fd, "why");
  if (!name || !place) return { error: "Add your name and where the photo was taken." };
  if (!why) return { error: "Tell us why it should be pic of the week." };
  if (why.length > PIC_WHY_MAX) return { error: `Keep the "why" to ${PIC_WHY_MAX} characters (you have ${why.length}).` };
  if (entriesThisWeek(u.id) >= PIC_MAX_PER_WEEK) return { error: `You can enter up to ${PIC_MAX_PER_WEEK} photos a week. Try again next week!` };
  const img = await saveImage(fd.get("photo"));
  if ("error" in img) return { error: img.error };
  run("INSERT INTO pic_submissions (user_id, image_id, name, place, why) VALUES (?, ?, ?, ?, ?)", u.id, img.id, name, place, why);
  return { ok: "You're entered! We pick a winner every week." };
}

export async function judgePic(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const action = str(fd, "op");
  const pic = get<{ id: number; image_id: string; user_id: number | null; name: string }>("SELECT id, image_id, user_id, name FROM pic_submissions WHERE id = ?", id);
  if (!pic) return;
  if (action === "winner") {
    run("UPDATE pic_submissions SET status = 'winner', won_at = datetime('now') WHERE id = ?", id);
    const u = pic.user_id ? get<{ email: string; name: string }>("SELECT email, name FROM users WHERE id = ?", pic.user_id) : undefined;
    if (u) {
      await sendEmail({
        userId: pic.user_id, to: u.email, kind: "pic-winner",
        subject: `Your photo is ${BUSINESS_NAME}'s pic of the week!`,
        body: `Hi ${u.name.split(" ")[0]},\n\nYour photo won pic of the week and is up on our homepage: ${APP_URL}\n\nYour $20 DoorDash gift card is on its way to this email address.\n\n${BUSINESS_NAME}`,
      });
    }
  }
  if (action === "decline") run("UPDATE pic_submissions SET status = 'declined' WHERE id = ?", id);
  if (action === "pending") run("UPDATE pic_submissions SET status = 'pending', won_at = NULL WHERE id = ?", id);
  if (action === "gift") run("UPDATE pic_submissions SET gift_card_sent = 1 - gift_card_sent WHERE id = ?", id);
  if (action === "delete") {
    run("DELETE FROM pic_submissions WHERE id = ?", id);
    deleteImage(pic.image_id);
  }
  revalidatePath("/", "layout");
}

/* ---------- About page ---------- */

export async function saveAbout(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  setSetting("about_title", str(fd, "title").slice(0, 80) || null);
  setSetting("about_bio", String(fd.get("bio") ?? "").trim().slice(0, 8000));
  revalidatePath("/about");
  return { ok: "Saved. Your About page is updated." };
}

export async function addAboutPhoto(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  if ((get<{ n: number }>("SELECT COUNT(*) n FROM about_photos")?.n ?? 0) >= 24) return { error: "That's the limit of 24 photos. Remove one first." };
  const img = await saveImage(fd.get("photo"));
  if ("error" in img) return { error: img.error };
  const sort = (get<{ m: number }>("SELECT COALESCE(MAX(sort), 0) m FROM about_photos")?.m ?? 0) + 10;
  run("INSERT INTO about_photos (image_id, caption, sort) VALUES (?, ?, ?)", img.id, str(fd, "caption").slice(0, 140), sort);
  revalidatePath("/about");
  revalidatePath("/admin/about");
  return { ok: "Photo added." };
}

export async function editAboutPhoto(fd: FormData) {
  await requireOperator();
  const id = Number(fd.get("id"));
  const row = get<{ image_id: string; sort: number }>("SELECT image_id, sort FROM about_photos WHERE id = ?", id);
  if (!row) return;
  const action = str(fd, "op");
  if (action === "delete") {
    run("DELETE FROM about_photos WHERE id = ?", id);
    deleteImage(row.image_id);
  } else if (action === "up" || action === "down") {
    const list = all<{ id: number }>("SELECT id FROM about_photos ORDER BY sort, id");
    const i = list.findIndex((p) => p.id === id);
    const j = action === "up" ? i - 1 : i + 1;
    if (j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((p, k) => run("UPDATE about_photos SET sort = ? WHERE id = ?", (k + 1) * 10, p.id));
    }
  } else {
    run("UPDATE about_photos SET caption = ? WHERE id = ?", str(fd, "caption").slice(0, 140), id);
  }
  revalidatePath("/about");
  revalidatePath("/admin/about");
}

/* ---------- Homepage notices & promos ---------- */

export async function saveSiteSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireOperator();
  const total = str(fd, "charity_total").replace(/[$,]/g, "");
  if (total && !/^\d{1,7}(\.\d{1,2})?$/.test(total)) return { error: "Enter the donated total in dollars, e.g. 1250 or 1250.50." };
  const asOf = str(fd, "charity_as_of");
  if (asOf && !isDate(asOf)) return { error: "Pick the date for the donation total." };
  const promoEnd = str(fd, "promo_early_end");
  if (promoEnd && !isDate(promoEnd)) return { error: "Pick an end date for the early season promotion." };
  setSetting("charity_name", str(fd, "charity_name").slice(0, 80) || null);
  setSetting("charity_url", str(fd, "charity_url").slice(0, 200));
  setSetting("charity_total_cents", total ? String(Math.round(Number(total) * 100)) : null);
  setSetting("charity_as_of", asOf || null);
  setSetting("promo_early_end", promoEnd || null);
  revalidatePath("/", "layout");
  return { ok: "Saved. The homepage shows the new numbers now." };
}
