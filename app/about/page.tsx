/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { getAbout, getCharity } from "@/lib/site";
import { mediaUrl } from "@/lib/media";
import { money, fmtDate } from "@/lib/services";
import { PHOTOS } from "@/lib/images";

export const metadata: Metadata = { title: "About us · Edge RX" };

export default function About() {
  const about = getAbout();
  const charity = getCharity();
  const [lead, ...rest] = about.photos;
  return (
    <main className="page container">
      <div className="about">
        <div className="about-copy">
          <span className="eyebrow">About us</span>
          <h1 style={{ marginTop: 8 }}>{about.title}</h1>
          {about.bio.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para.split("\n").map((line, j) => (j ? [<br key={j} />, line] : line))}</p>
          ))}
          <div className="charity" style={{ marginTop: 24 }}>
            <span className="heart" aria-hidden>♥</span>
            <div>A portion of every tune supports local charities, including the {charity.name}.</div>
            {charity.totalCents > 0 && (
              <div className="raised"><b>{money(charity.totalCents)}</b><small>donated{charity.asOf ? ` as of ${fmtDate(charity.asOf, true)}` : ""}</small></div>
            )}
          </div>
          <div className="flex" style={{ marginTop: 24 }}>
            <Link href="/book" className="btn accent">Schedule a pickup</Link>
            <Link href="/#services" className="btn ghost">Services</Link>
          </div>
        </div>
        <figure className="about-lead">
          <img src={lead ? mediaUrl(lead.image_id)! : PHOTOS.bench.src(1000)} alt={lead?.caption || PHOTOS.bench.alt} />
          {lead?.caption && <figcaption>{lead.caption}</figcaption>}
        </figure>
      </div>
      {rest.length > 0 && (
        <div className="about-gallery">
          {rest.map((p) => (
            <figure key={p.id}>
              <img src={mediaUrl(p.image_id)!} alt={p.caption || "Edge RX"} loading="lazy" />
              {p.caption && <figcaption>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
