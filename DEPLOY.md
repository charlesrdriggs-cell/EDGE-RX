# Putting Edge RX online

This takes about 30 minutes. You'll end up with the site at your own domain, real emails, and weekly reminders running automatically.

**Monthly cost:** about $5 (Railway) plus about $12/year for a domain. Resend email is free up to 3,000 emails a month.

---

## 1. Host the site on Railway

Railway runs the app straight from your GitHub repo and redeploys every time `main` changes.

1. Go to **railway.com**, sign up with your GitHub account, and choose the **Hobby** plan ($5/month).
2. Click **New Project → Deploy from GitHub repo** and pick **edge-rx**.
3. **Add a volume** so customer data survives redeploys. This step matters: without it, every deploy wipes the database.
   - In the project, right-click the edge-rx service → **Attach volume**.
   - Mount path: `/data`
4. Open the service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_PATH` | `/data/app.db` |
   | `SESSION_SECRET` | a long random string (mash the keyboard for 40+ characters) |
   | `OPERATOR_EMAIL` | the email you'll log in with |
   | `OPERATOR_PASSWORD` | your password (change it later with "Forgot password?" if you like) |
   | `CRON_SECRET` | another long random string |
   | `BUSINESS_TIMEZONE` | `America/New_York` (or wherever you operate) |
   | `APP_URL` | fill in after step 5 |

5. Under **Settings → Networking**, click **Generate Domain**. You'll get something like `edge-rx-production.up.railway.app`. Put that full address (with `https://`) in `APP_URL`.
6. Railway redeploys. Open the address, click **Log in**, and use your operator email and password. You should land on the dashboard.

### Use your own domain (optional, recommended)
Buy a domain (Namecheap, Cloudflare or Squarespace Domains, ~$12/year), then in Railway **Settings → Networking → Custom Domain** enter it, e.g. `edgerx.com`. Railway shows a DNS record to add at your domain registrar. Once it's live, update `APP_URL` to `https://edgerx.com`.

---

## 2. Turn on email with Resend

Until this is set up, emails are saved on the dashboard under **Reminders & emails** instead of being sent.

1. Sign up at **resend.com** (free plan).
2. **Domains → Add Domain** and enter your domain. Resend lists 3 or 4 DNS records; add them at your domain registrar and click **Verify**. (This is what keeps your emails out of spam. It usually verifies within an hour.)
3. **API Keys → Create API Key** with "Sending access". Copy it.
4. In Railway Variables add:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Edge RX <tunes@edgerx.com>` (any address at your verified domain)
5. Test it: on the site, log out, click **Log in → Forgot password?** and enter your operator email. The reset email should arrive within a minute.

---

## 3. Weekly reminders on autopilot

The repo includes a GitHub Action (`.github/workflows/weekly-reminders.yml`) that sends reminders **every Thursday at 9 AM Eastern**, just before the weekend.

1. On GitHub open **edge-rx → Settings → Secrets and variables → Actions → New repository secret** and add:
   - `SITE_URL` = your site address, e.g. `https://edgerx.com`
   - `CRON_SECRET` = the same value you put in Railway
2. To test it, go to the **Actions** tab → **Weekly reminders** → **Run workflow**. Then check **Reminders & emails** on your dashboard.

To change the day or time, edit the `cron:` line in that file (it's in UTC).

---

## 4. Payments with Stripe (optional)

Skip this if you're happy taking cash or Venmo at pickup and clicking **Mark paid**.

1. Sign up at **stripe.com** and finish the business details so you can receive payouts.
2. **Developers → API keys** and copy the **Secret key**. Start with the test key (`sk_test_...`) to try it with card `4242 4242 4242 4242`.
3. Add `STRIPE_SECRET_KEY` in Railway. Bookings now show a **Pay now** button.
4. When you're ready for real money, swap in the live key (`sk_live_...`).

---

## 5. First things to set in the dashboard

- **Schedule & limits:** set how many pickups you can handle per day, and block off days you're away.
- Make a test booking with a second email address to see the full customer experience, then cancel it.

## If something goes wrong

- **Site shows an error after deploy:** in Railway open the service → **Deployments → View logs**. A missing `SESSION_SECRET` is the most common cause.
- **Data disappeared after a deploy:** the volume isn't attached or `DATABASE_PATH` doesn't point inside `/data`.
- **Emails not arriving:** check the **Delivery** column under Reminders & emails. `failed (403)` usually means the domain isn't verified in Resend yet.
