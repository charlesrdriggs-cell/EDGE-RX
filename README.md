# Edge RX

Website and ordering/scheduling platform for a ski and snowboard tuning side hustle.
Built with Next.js 15 and SQLite (Node's built-in `node:sqlite`, so there's no database server to run).

## What it does

**Customers**
- Create an account with name, email, phone, pickup/drop-off address and (optionally) their next ski trip date.
- Book a tune: choose saved gear or add new skis/snowboard, pick a service and specs, add base repair, choose pickup and return (due) dates. Price updates live.
- Get a confirmation email, see their bookings and status, cancel while still scheduled, pay online (if Stripe is on).
- Weekly reminder emails to book a tune before an upcoming trip (opt out any time on their account page).
- Forgot-password flow: a one-hour reset link by email.
- **Shop** (`/shop`): add HOTHANDS warmers, goggle cleaning and other extras while booking, from a booking's page, or on their own. Extras on a tune come back with the gear on its return date; stand-alone orders get their own delivery date.

**Services and pricing** (defaults in `lib/services.ts`; change live prices from the dashboard)
| Service | Price | Specs captured |
|---|---|---|
| Basic Ski & Snowboard Tune | $50 | Wax: Warm, All Season, Cold, Polar |
| Performance/Race Day Tune | $65 | Base bevel 0.5° to 0.7°, side edge 1° to 5° (with an info bubble explaining both) |
| #SKIFAST Ski Team Tune | $40 | Performance/Race Day Tune for a registered racer (name, age, school/team) |
| Minor base repair (add-on) | +$15 | |
| Learn to Tune Session (1.5 hrs, at the customer's house) | $200 | Booked at `/book/learn` |

**Promotions and rewards**
- Early season: tune 3, get 1 free. In one pickup, every 4th piece's tune (the lowest priced) is free when pickup is on or before the end date (default Dec 15, editable at `/admin/site`).
- Rewards: $25 credit for every $250 spent (tunes once picked up or paid, shop orders delivered or paid, sessions done or paid). Progress tracker on the account page; credit shares the referral credit balance.

**Bookings**
- 48 hours' notice for pickups and sessions.
- One booking can hold several pieces (a whole household). Each piece gets its own tag showing "N of total", the owner's name and the pickup spot.

**Homepage and community**
- Resort conditions search and destination 7-day forecast (Open-Meteo, see below), with a wax suggestion.
- Charity notice (South Shore Foodbank) with an editable total and date (`/admin/site`).
- Pic of the week contest (`/pic-of-the-week`, judged at `/admin/pics`).
- Polls with up to 5 answers plus an optional "Other" write-in, and an archive (`/polls`, managed at `/admin/polls`, where write-ins are listed), plus a "Where Edge RX skis" tally of customers' home mountains and best runs.
- About page (`/about`) with bio and photos edited at `/admin/about`.
- Suggestions box on the account page (read at `/admin/suggestions`).

**Operator (you)** at `/admin`
- Order board with tabs (to pick up, in the shop, ready, returned) and counters for pickups today, due soon and overdue.
- Change status (Scheduled → Picked up → In progress → Ready → Returned). Marking **Ready** emails the customer.
- Mark orders paid or unpaid.
- **Printable tags**: one per piece on Zebra 4" × 2.5" labels (print, or download ZPL at 203/300 dpi), or on letter paper (4 × 2.6 in) with tag number, customer name, pickup date, due date, address, phone, gear description and service specs. Print one, all active, or all pickups for a date.
- **Prices** (`/admin/prices`): change tune and base repair prices without touching code. Bookings keep the price they were made at.
- **Schedule & limits:** set a max number of pickups per day and block off dates (vacations, race weekends). Full or blocked days can't be picked when booking.
- **Retail** (`/admin/shop`): orders to deliver, mark delivered or paid. **Products** (`/admin/shop/products`): add items, set prices and stock (blank = unlimited), hide or reorder them. Starter products ship with **placeholder prices** flagged until you save each one. Tune tags list any extras to bring back.
- Customer list, and an email log showing every confirmation and reminder.

## Run it locally

Requires Node 22.13 or newer.

```bash
cp .env.example .env     # then edit the values
npm install
npm run dev              # http://localhost:3000
```

Your operator login is the `OPERATOR_EMAIL` / `OPERATOR_PASSWORD` from `.env`; the account is created on first start.

**Going live?** Follow [DEPLOY.md](DEPLOY.md) for step-by-step Railway, Resend, reminders and Stripe setup.

## Accounts you'll need

| What | Why | Cost | Setting |
|---|---|---|---|
| **Resend** (resend.com) | Sends confirmation, "ready" and weekly reminder emails. Verify your domain so mail doesn't land in spam. | Free up to 3,000 emails/month | `RESEND_API_KEY`, `EMAIL_FROM` |
| **Stripe** (stripe.com), optional | "Pay now" button on bookings via Stripe Checkout. Without it, customers pay at pickup and you mark orders paid. | 2.9% + 30¢ per card payment | `STRIPE_SECRET_KEY` |
| **Hosting with a persistent disk** | SQLite stores data in a file, so the host must keep files between deploys. Railway, Render (with a disk) or Fly.io all work; set `DATABASE_PATH` to the mounted disk. Vercel/Netlify won't keep the file, so you'd swap to Postgres there. | ~$5 to $7/month | `DATABASE_PATH` |
| **Open-Meteo** (open-meteo.com) | Resort conditions and destination forecasts. Works with no key; the free tier is for non-commercial use, so for the business take their API plan and paste the key. | Free to try, paid plan for commercial use | `OPEN_METEO_API_KEY` (optional) |
| **A domain** | e.g. edgerx.com, for the site and email sending | ~$12/year | `APP_URL` |

Until Resend is set up, emails are **saved to the outbox** at `/admin/reminders` instead of being sent, so everything still works end to end.

## Weekly reminders

`GET /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>` sends the weekly batch.
The included GitHub Action (`.github/workflows/weekly-reminders.yml`) calls it every Thursday morning; see DEPLOY.md. Any other scheduler works too:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite.com/api/cron/reminders
```

Who gets one: customers who opted in, have no open booking, and haven't had a reminder in the last 6 days. If they saved a trip date, the email mentions it. You can also click **Send reminders now** in the dashboard.

## Referrals

Customers get a referral link (`/r/CODE`) and a **Refer a friend** box on their account page where they can invite people by email or phone number.

- Email invites go out through Resend (or the outbox until it's set up).
- Text invites go out through Twilio when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` are set. Without Twilio, the customer gets a one-tap link to send the same invite from their own phone.
- A new customer is linked to whoever referred them by the code they signed up with, or else by the first invite sent to their email or phone.
- The referrer earns **$10 credit** once that new customer's first order is picked up (or paid). Waiting for pickup stops book-and-cancel abuse. One reward per new customer.
- Credit comes off the referrer's next booking automatically (and is returned if that booking is cancelled). Customers can't refer existing customers or themselves.
- `/admin/referrals` shows referred customers, every invite, the credit history, and lets you add or remove credit by hand.

## Code map

- `lib/services.ts`: services, prices, specs, statuses
- `lib/db.ts`: database schema (created automatically)
- `lib/email.ts`, `lib/reminders.ts`: email sending and the weekly reminder logic
- `lib/payments.ts`: Stripe Checkout (no SDK needed)
- `app/actions.ts`: all form handling (signup, booking, status changes)
- `lib/shop.ts`, `app/shop-actions.ts`, `app/shop/`: retail products, orders and stock
- `app/book/`: booking form, `app/account/`: customer page, `app/admin/`: operator dashboard and tags

## Ideas for later

- Text message (SMS) reminders via Twilio
- QR code on tags that opens the order
