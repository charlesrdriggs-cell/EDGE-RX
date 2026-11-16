import Link from "next/link";
import { SERVICES, BASE_REPAIR, money } from "@/lib/services";

export default function Home() {
  const services = [SERVICES.basic, SERVICES.race];
  return (
    <main>
      <section className="hero">
        <div className="container">
          <span className="badge accent">Pickup &amp; drop off included</span>
          <h1 style={{ marginTop: 16 }}>Sharp edges. Fast bases.<br />We come to you.</h1>
          <p>
            Schedule a pickup, tell us when your trip is, and your skis or snowboard come back
            stone ground, sharpened and waxed for the conditions you&apos;ll ride.
          </p>
          <div className="cta">
            <Link href="/book" className="btn accent">Schedule a pickup</Link>
            <Link href="#services" className="btn ghost">See services</Link>
          </div>
        </div>
        <svg className="mountains" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
          <path d="M0 90 L0 60 L180 20 L320 55 L480 10 L640 50 L820 15 L980 55 L1140 25 L1300 50 L1440 30 L1440 90 Z" fill="#f6f9fc" />
        </svg>
      </section>

      <section className="section" id="services">
        <div className="container">
          <h2>Services</h2>
          <p className="muted">Flat pricing per pair of skis or snowboard. Pickup and return are always included.</p>
          <div className="grid-2" style={{ marginTop: 20 }}>
            {services.map((s) => (
              <div key={s.id} className={`card service ${s.id === "race" ? "featured" : ""}`}>
                {s.id === "race" && <span className="badge accent" style={{ alignSelf: "flex-start" }}>Race prep</span>}
                <h3 style={{ marginTop: 8 }}>{s.name}</h3>
                <div className="price">{money(s.priceCents)}</div>
                <p className="muted" style={{ margin: 0 }}>{s.tagline}</p>
                <ul>{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                <Link href={`/book?service=${s.id}`} className={`btn ${s.id === "race" ? "accent" : ""}`}>
                  Book {s.name}
                </Link>
              </div>
            ))}
          </div>
          <div className="card flex between" style={{ marginTop: 20 }}>
            <div>
              <strong>Add-on: {BASE_REPAIR.name}</strong>
              <div className="muted">Fill core shots and gouges before your tune.</div>
            </div>
            <div className="price" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--brand)" }}>
              +{money(BASE_REPAIR.priceCents)}
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "#fff", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="container">
          <h2>How it works</h2>
          <div className="grid-3" style={{ marginTop: 20 }}>
            {[
              ["Create an account", "Save your address, phone and gear once. Rebook in seconds."],
              ["Pick your dates", "Choose a pickup date and when you need your gear back."],
              ["We pick up and tune", "Every pair gets a tag so nothing gets mixed up in the shop."],
              ["Back before your trip", "Gear is dropped off on your due date, ready to ride."],
            ].map(([t, d], i) => (
              <div key={t}>
                <div className="step-num">{i + 1}</div>
                <strong>{t}</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container card flex between">
          <div>
            <h2 style={{ marginBottom: 4 }}>Trip coming up?</h2>
            <span className="muted">Sign up and we&apos;ll send a weekly reminder so you never ski on dull edges.</span>
          </div>
          <Link href="/signup" className="btn accent">Create an account</Link>
        </div>
      </section>
    </main>
  );
}
