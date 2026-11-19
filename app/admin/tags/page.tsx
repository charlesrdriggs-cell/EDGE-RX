import Link from "next/link";
import { todayISO } from "@/lib/services";
import { selectTagOrders, buildTags, LABEL } from "@/lib/tags";
import PrintButton from "./PrintButton";
import LogoMark from "@/app/components/LogoMark";

type SP = { id?: string; date?: string; group?: string; format?: string };

export default async function Tags({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { orders, title, date } = selectTagOrders(sp);
  const tags = buildTags(orders);
  const paper = sp.format === "paper";
  // Keep the current selection when switching format or downloading ZPL
  const sel = new URLSearchParams(Object.entries({ id: sp.id, date: sp.date, group: sp.group }).filter(([, v]) => v) as [string, string][]);
  const withParams = (extra: Record<string, string>) => {
    const q = new URLSearchParams(sel);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v); else q.delete(k);
    return q.toString();
  };

  return (
    <div className={paper ? "" : "label-mode"}>
      {!paper && (
        // One tag per 4" x 2.5" label, no margins, for Zebra label printers
        <style>{`@media print { @page { size: ${LABEL.widthIn}in ${LABEL.heightIn}in; margin: 0; } }`}</style>
      )}
      <div className="no-print card stack" style={{ marginBottom: 20 }}>
        <div className="flex between">
          <div>
            <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{title}</h1>
            <span className="muted">
              {tags.length} tag{tags.length === 1 ? "" : "s"}.{" "}
              {paper
                ? "Letter paper: tags print at 4 × 2.6 in; cut along the dashed line and zip-tie through the hole."
                : `Zebra labels: one tag per ${LABEL.widthIn}" × ${LABEL.heightIn}" label.`}
            </span>
          </div>
          <div className="tabs" style={{ margin: 0 }}>
            <Link href={`/admin/tags?${withParams({ format: "" })}`} className={paper ? "" : "on"}>Zebra 4×2.5 label</Link>
            <Link href={`/admin/tags?${withParams({ format: "paper" })}`} className={paper ? "on" : ""}>Letter paper</Link>
          </div>
        </div>
        <form className="flex" action="/admin/tags">
          {!paper ? null : <input type="hidden" name="format" value="paper" />}
          <input type="date" name="date" defaultValue={date ?? todayISO()} style={{ width: "auto" }} />
          <button className="btn light sm">Show pickups</button>
          <Link href={`/admin/tags${paper ? "?format=paper" : ""}`} className="btn light sm">All active</Link>
          <PrintButton />
          {!paper && tags.length > 0 && (
            <>
              <a href={`/admin/tags/zpl?${withParams({ dpi: "203" })}`} className="btn light sm">ZPL · 203 dpi</a>
              <a href={`/admin/tags/zpl?${withParams({ dpi: "300" })}`} className="btn light sm">ZPL · 300 dpi</a>
            </>
          )}
        </form>
        {!paper && (
          <details className="hint">
            <summary style={{ cursor: "pointer" }}>Zebra printer setup (ZD421, ZD620, ZD621, GC420, GK420, GX430, LP2844, ZP500)</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              <li><strong>Print button (works on every model):</strong> install the Zebra driver (ZDesigner), set the label size to 4 × 2.5 in, then pick the Zebra printer in the print dialog with margins set to None and scale at 100%. Each tag prints on its own label.</li>
              <li><strong>ZPL download (sharpest, fastest):</strong> sends the tags as printer commands. Use 203 dpi for the GC420, GK420, ZP500, LP2844-Z and 203 dpi ZD421/ZD620/ZD621; use 300 dpi for the GX430t and 300 dpi ZD421/ZD620/ZD621 (check the sticker on the printer). Send the file with Zebra Setup Utilities → Open Communication With Printer → Send File, or copy it to the printer&apos;s shared queue.</li>
              <li><strong>LP2844:</strong> the original LP2844 speaks EPL, not ZPL. Use the Print button for it. The LP2844-Z model takes the ZPL file.</li>
              <li>Direct thermal labels print black only, so tags use solid black text and lines.</li>
            </ul>
          </details>
        )}
      </div>
      <div className="tags">
        {tags.map((t) => (
          <div key={t.id} className="tag">
            {paper && <div className="hole" />}
            <div className="code">
              <LogoMark size={paper ? 26 : 22} bg="#000" peak="#fff" bevel="" />{t.code}
              <span className="of">{t.n} of {t.total}</span>
            </div>
            <div className="name">{t.customer}{t.owner ? <span className="owner"> · {t.owner}</span> : null}</div>
            <div className="dates">
              <div><small>Pick up</small><b>{t.pickup}</b></div>
              <div className="due"><small>Due / return</small><b>{t.due}</b></div>
            </div>
            <div className="line"><small>Address</small>{t.address}</div>
            {t.spot && <div className="line"><small>Left at</small>{t.spot}</div>}
            <div className="line"><small>Phone</small>{t.phone}</div>
            <div className="line"><small>{t.gearLabel}</small>{t.gear}</div>
            <div className="svc">{t.service}</div>
            {t.extras.map((x, i) => <div key={i} className="extras">+ Bring back: {x}</div>)}
          </div>
        ))}
        {tags.length === 0 && <p className="muted">No orders match.</p>}
      </div>
    </div>
  );
}
