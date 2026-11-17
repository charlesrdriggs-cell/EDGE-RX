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

**Services and pricing** (edit in `lib/services.ts`)
| Service | Price | Specs captured |
|---|---|---|
| Basic Ski Tune | $50 | Wax: Warm, All Season, Cold, Polar |
| Race Day Tune | $65 | Base bevel 0.5° to 0.7°, side edge 1° to 5° |
| Minor base repair (add-on) | +$15 | |

**Operator (you)** at `/admin`
- Order board with tabs (to pick up, in the shop, ready, returned) and counters for pickups today, due soon and overdue.
- Change status (Scheduled → Picked up → In progress → Ready → Returned). Marking **Ready** emails the customer.
- Mark orders paid or unpaid.
- **Printable tags** (4 × 2.6 in, one per pair) with tag number, customer name, pickup date, due date, address, phone, gear description and service specs. Print one, all active, or all pickups for a date.
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
| **A domain** | e.g. edgerx.com, for the site and email sending | ~$12/year | `APP_URL` |

Until Resend is set up, emails are **saved to the outbox** at `/admin/reminders` instead of being sent, so everything still works end to end.

## Weekly reminders

`GET /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>` sends the weekly batch.
The included GitHub Action (`.github/workflows/weekly-reminders.yml`) calls it every Thursday morning; see DEPLOY.md. Any other scheduler works too:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite.com/api/cron/reminders
```

Who gets one: customers who opted in, have no open booking, and haven't had a reminder in the last 6 days. If they saved a trip date, the email mentions it. You can also click **Send reminders now** in the dashboard.

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
