/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { SERVICES, BASE_REPAIR, money } from "@/lib/services";
import { getPrices } from "@/lib/pricing";
import { PHOTOS } from "@/lib/images";

const TICKER = [
  "Stone grind", "Edge sharpen & bevel", "Hot wax to spec", "Diamond polish",
  "Base 0.5°–0.7°", "Side edge 1°–5°", "Free pickup & drop off", "Race wax",
];

export default function Home() {
  const prices = getPrices();
  const services = [SERVICES.basic, SERVICES.race];
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

      {/* Services */}
      <section className="section" id="services">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">The menu</span>
              <h2>Pick your tune</h2>
            </div>
            <p className="muted">Flat price per pair of skis or snowboard. Pickup and return are always included.</p>
          </div>
          <div className="grid-2">
            {services.map((s) => (
              <div key={s.id} className={`card service ${s.id === "race" ? "featured" : ""}`}>
                <span className={`badge ${s.id === "race" ? "accent" : ""}`} style={{ alignSelf: "flex-start" }}>
                  {s.id === "race" ? "Race prep" : "Most popular"}
                </span>
                <h3 style={{ marginTop: 14, marginBottom: 0 }}>{s.name}</h3>
                <div className="price">{money(prices[s.id])}<small>/ pair</small></div>
                <p className="muted tagline">{s.tagline}</p>
                <ul>{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                <Link href={`/book?service=${s.id}`} className={`btn ${s.id === "race" ? "accent" : ""}`}>
                  Book {s.name}
                </Link>
              </div>
            ))}
          </div>
          <div className="card addon">
            <div>
              <h3 style={{ margin: 0 }}>Add-on: {BASE_REPAIR.name}</h3>
              <div className="muted">Core shots and gouges filled before your tune.</div>
            </div>
            <div className="price">+{money(prices.repair)}</div>
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
