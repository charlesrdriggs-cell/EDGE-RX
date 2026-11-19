/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SERVICES, BASE_REPAIR, LESSON, money, fmtDate } from "@/lib/services";
import { getCharity, earlySeasonActive, earlySeasonEnd, mountainTally, recentBestRuns } from "@/lib/site";
import { activePoll } from "@/lib/polls";
import { currentWinner, PIC_PRIZE } from "@/lib/pics";
import { RESORTS } from "@/lib/weather";
import WeatherWidget from "@/app/components/WeatherWidget";
import PollCard from "@/app/components/PollCard";
import { getPrices } from "@/lib/pricing";
import { PHOTOS } from "@/lib/images";
import { getServicePhotos } from "@/lib/pricing";
import { mediaUrl } from "@/lib/media";

const TICKER = [
  "Stone grind", "Edge sharpen & bevel", "Hot wax to spec", "Diamond polish",
  "Base 0.5°–0.7°", "Side edge 1°–5°", "Free pickup & drop off", "Skis & snowboards", "#SKIFAST",
];

export default async function Home() {
  const prices = getPrices();
  const services = [SERVICES.basic, SERVICES.race];
  const photos = getServicePhotos();
  const charity = getCharity();
  const promoEnd = earlySeasonActive() ? earlySeasonEnd() : null;
  const poll = activePoll();
  const winner = currentWinner();
  const mountains = mountainTally("home_mountain", 6);
  const runs = recentBestRuns(5);
  const topMountain = Math.max(...mountains.rows.map((m) => m.n), 1);
  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div>
            <span className="eyebrow">Ski &amp; snowboard tuning · We come to you</span>
            <h1>Sharp edges.<br /><em>Fast bases.</em></h1>
            <p>
              Book a pickup, tell us when you&apos;re heading out, and your gear comes back stone ground,
              sharpened and waxed for the snow you&apos;ll ride. Dropped at your door before your trip.
            </p>
            <div className="cta">
              <Link href="/book" className="btn accent">Schedule a pickup</Link>
              <Link href="#services" className="btn ghost">Services &amp; prices</Link>
            </div>
            <div className="proof">
              <span><b>{money(prices.basic)}</b> full tune</span>
              <span><b>FREE</b> pickup &amp; drop off</span>
              <span><b>TAGGED</b> &amp; tracked</span>
            </div>
          </div>
          <div className="hero-media">
            <img src={PHOTOS.hero.src(1200)} alt={PHOTOS.hero.alt} />
            <div className="spec-card">
              <div className="head"><span>Tune ticket</span><b>RACE DAY</b></div>
              <div className="spec-row">
                <div><small>Base bevel</small><span>Flat &amp; fast</span></div>
                <div className="v">0.5<sup>°</sup></div>
                <div className="spec-meter"><i style={{ width: "35%" }} /></div>
              </div>
              <div className="spec-row">
                <div><small>Side edge</small><span>Ice grip</span></div>
                <div className="v">3<sup>°</sup></div>
                <div className="spec-meter"><i style={{ width: "60%" }} /></div>
              </div>
              <div className="stamp"><span>Racing wax · Diamond polish</span><b>Ready</b></div>
            </div>
          </div>
        </div>
      </section>

      <div className="strip" aria-hidden>
        <div>{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}</div>
      </div>

      {/* Charity notice */}
      <section className="container">
        <div className="charity">
          <span className="heart" aria-hidden>♥</span>
          <div>
            <strong>Every tune gives back.</strong> A portion of our proceeds supports local charities, including the{" "}
            {charity.url ? <a href={charity.url} target="_blank" rel="noopener">{charity.name}</a> : charity.name}.
          </div>
          {charity.totalCents > 0 && (
            <div className="raised">
              <b>{money(charity.totalCents)}</b>
              <small>donated{charity.asOf ? ` as of ${fmtDate(charity.asOf, true)}` : ""}</small>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section className="section" id="services">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">The menu</span>
              <h2>Pick your tune</h2>
            </div>
            <p className="muted">Flat price per pair of skis or per snowboard. Pickup and return are always included.</p>
          </div>
          <div className="grid-2">
            {services.map((s) => (
              <div key={s.id} className={`card service ${s.id === "race" ? "featured" : ""}`}>
                {photos[s.id] && <img src={mediaUrl(photos[s.id])!} alt={s.name} className="service-photo" />}
                <span className={`badge ${s.id === "race" ? "accent" : ""}`} style={{ alignSelf: "flex-start" }}>
                  {s.id === "race" ? "Race prep" : "Most popular"}
                </span>
                <h3 style={{ marginTop: 14, marginBottom: 0 }}>{s.name}</h3>
                <div className="price">{money(prices[s.id])}<small>/ {s.id === "basic" ? "pair or board" : "pair"}</small></div>
                <p className="muted tagline">{s.tagline}</p>
                <ul>{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                <Link href={`/book?service=${s.id}`} className={`btn ${s.id === "race" ? "accent" : ""}`}>
                  Book {s.name}
                </Link>
              </div>
            ))}
          </div>
          <div className="card addon">
            {photos.repair && <img src={mediaUrl(photos.repair)!} alt={BASE_REPAIR.name} className="addon-photo" />}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>Add-on: {BASE_REPAIR.name}</h3>
              <div className="muted">Core shots and gouges filled before your tune.</div>
            </div>
            <div className="price">+{money(prices.repair)}</div>
          </div>
          <div className="card lesson-card">
            {photos.lesson && <img src={mediaUrl(photos.lesson)!} alt={LESSON.name} className="addon-photo" />}
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="badge accent">New · {LESSON.length}</span>
              <h3 style={{ margin: "8px 0 4px" }}>{LESSON.name}</h3>
              <div className="muted">{LESSON.tagline}</div>
              <div style={{ marginTop: 6 }}><strong>Pro tip:</strong> {LESSON.proTip}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="price">{money(prices.lesson)}</div>
              <Link href="/book/learn" className="btn sm accent">Book a session</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Promotions */}
      <section className="section" style={{ paddingTop: 0 }} id="promos">
        <div className="container grid-2">
          {promoEnd && (
            <div className="card promo red">
              <span className="eyebrow">Early season · until {fmtDate(promoEnd)}</span>
              <h2>Tune 3, get 1 free</h2>
              <p className="muted">Book four pieces on one pickup by {fmtDate(promoEnd)} and the fourth tune is on us. Get the whole family ready for opening day.</p>
              <Link href="/book" className="btn accent">Book the family</Link>
            </div>
          )}
          <div className="card promo">
            <span className="eyebrow">Ski team promo</span>
            <h2>#SKIFAST · {money(prices.skifast)}</h2>
            <p className="muted">
              School and club racers get a full Performance/Race Day Tune for {money(prices.skifast)}. Register your racer&apos;s
              name, age and school or team on your account, then pick them when you book.
            </p>
            <Link href="/account#skifast" className="btn">Register a racer</Link>
          </div>
        </div>
      </section>

      {/* Mountain tools */}
      <section className="section dark" id="conditions">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Before you go</span>
              <h2>Conditions &amp; forecast</h2>
            </div>
            <p className="muted">Check new snow at your mountain and the week ahead at your destination, then pick the wax to match.</p>
          </div>
          <div className="grid-2">
            <div>
              <h3>Resort conditions</h3>
              <WeatherWidget mode="conditions" resorts={RESORTS} />
            </div>
            <div>
              <h3>Destination forecast</h3>
              <WeatherWidget mode="forecast" resorts={RESORTS} />
            </div>
          </div>
        </div>
      </section>

      {/* Photo band + how it works */}
      <section className="photo-band">
        <img src={PHOTOS.skier.src(2000)} alt={PHOTOS.skier.alt} />
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2>Door to slope in four steps</h2>
          <div className="steps">
            {[
              ["Book online", "Pick a service and your pickup and return dates. Takes a minute."],
              ["We pick up", "Leave your gear out. It gets a numbered tag so nothing mixes up."],
              ["Bench time", "Grind, edges, wax, done to the spec you chose."],
              ["Back at your door", "Dropped off on your due date, ready for the trip."],
            ].map(([t, d], i) => (
              <div key={t}>
                <div className="n">0{i + 1}</div>
                <strong>{t}</strong>
                <p className="muted" style={{ margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="section" id="community">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">The Edge RX crew</span>
              <h2>Community</h2>
            </div>
          </div>
          <div className="grid-3">
            <div className="card pic-week">
              <span className="eyebrow">Pic of the week</span>
              {winner ? (
                <>
                  <img src={mediaUrl(winner.image_id)!} alt={`Pic of the week by ${winner.name} at ${winner.place}`} />
                  <h3 style={{ margin: "12px 0 2px" }}>{winner.name}</h3>
                  <div className="muted">📍 {winner.place}</div>
                  <p style={{ fontStyle: "italic", margin: "8px 0 0" }}>&ldquo;{winner.why}&rdquo;</p>
                </>
              ) : (
                <p className="muted">Our first winner is coming soon. Could be you!</p>
              )}
              <p className="hint">Winners get their pic posted here and a {PIC_PRIZE}.</p>
              <Link href="/pic-of-the-week" className="btn sm accent">Enter your pic</Link>
            </div>
            {poll ? <PollCard poll={poll} /> : (
              <div className="card poll">
                <span className="eyebrow">Poll</span>
                <p className="muted">No poll running right now. <Link href="/polls">See past polls →</Link></p>
              </div>
            )}
            <div className="card">
              <span className="eyebrow">Where Edge RX skis</span>
              <h3 style={{ marginTop: 8 }}>Home mountains</h3>
              {mountains.rows.length === 0 ? (
                <p className="muted">Add your home mountain and best run on <Link href="/account#details">your account</Link> to be counted.</p>
              ) : (
                <div className="poll-bars">
                  {mountains.rows.map((m, i) => (
                    <div key={m.label} className={`bar ${i === 0 ? "lead" : ""}`}>
                      <i style={{ width: `${Math.round((m.n / topMountain) * 100)}%` }} />
                      <span>{m.label}</span><b>{m.n}</b>
                    </div>
                  ))}
                  <div className="hint">{mountains.total} customer{mountains.total === 1 ? "" : "s"} answered</div>
                </div>
              )}
              {runs.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16 }}>Best runs</h3>
                  <ul className="runs">
                    {runs.map((r, i) => <li key={i}><strong>{r.best_run}</strong>{r.home_mountain ? ` at ${r.home_mountain}` : ""} <span className="muted">· {r.first}</span></li>)}
                  </ul>
                </>
              )}
              <Link href="/account#details" className="more">Add yours →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Extras */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">More from Edge RX</span>
              <h2>Little extras, big days</h2>
            </div>
          </div>
          <div className="grid-3">
            <Link href="/shop" className="card feature-photo">
              <img src={PHOTOS.rack.src(800)} alt={PHOTOS.rack.alt} />
              <div>
                <h3>Shop add-ons</h3>
                <p className="muted">Hand warmers, goggle cleaning and more, delivered with your tuned gear.</p>
                <span className="more">Browse the shop →</span>
              </div>
            </Link>
            <Link href="/account#refer" className="card feature-photo">
              <img src={PHOTOS.rider.src(800)} alt={PHOTOS.rider.alt} />
              <div>
                <h3>Refer a friend, get $10</h3>
                <p className="muted">Share your link. When a friend has their first tune, you get credit off your next one.</p>
                <span className="more">Get your link →</span>
              </div>
            </Link>
            <Link href="/signup" className="card feature-photo">
              <img src={PHOTOS.bench.src(800)} alt={PHOTOS.bench.alt} />
              <div>
                <h3>Never ski dull edges</h3>
                <p className="muted">Save your next trip date and we&apos;ll send a weekly reminder to book before you go.</p>
                <span className="more">Create an account →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <div>
            <h2>Trip coming up?</h2>
            <p>Book now and your gear is back, tuned, before you leave.</p>
          </div>
          <Link href="/book" className="btn">Schedule a pickup</Link>
        </div>
      </section>
    </main>
  );
}
