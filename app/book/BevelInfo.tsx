"use client";

import { useState } from "react";

export const BEVEL_PRESETS = [
  { name: "Recreational Tune", note: "Best everyday option. Forgiving, predictable, easy edge release.", base: "0.7", side: "1" },
  { name: "Performance Tune", note: "Stronger grip, quicker engagement, responsive turning.", base: "0.5", side: "2" },
  { name: "Expert / Ice Tune", note: "Maximum practical grip for aggressive skiers and firm conditions.", base: "0.5", side: "3" },
] as const;

/** The "?" bubble next to the bevel choices on a Performance/Race Day Tune. */
export default function BevelInfo({ onPreset }: { onPreset?: (base: string, side: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bevel-info">
      <button type="button" className="info-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden>i</span> {open ? "Hide" : "What do base bevel and side edge mean?"}
      </button>
      {open && (
        <div className="info-bubble" role="note">
          <p>
            The <strong>base bevel</strong> and <strong>side edge bevel</strong> determine how aggressively a ski engages the snow,
            how easily it releases from a turn, and how much grip it has on hardpack and ice.
          </p>

          <h4>Base bevel (0.5°–0.7°)</h4>
          <p>
            The angle at which the bottom edge of the ski is filed upward away from the base. It controls how quickly the edge
            engages the snow when you roll the ski onto its edge.
          </p>
          <table>
            <thead><tr><th>Base bevel</th><th>Performance</th></tr></thead>
            <tbody>
              <tr><td>0.5°</td><td>Quicker edge engagement, more aggressive feel</td></tr>
              <tr><td>0.7°</td><td>Slightly slower engagement, easier turn initiation</td></tr>
              <tr><td>1.0°</td><td>More forgiving, easier edge release, less immediate grip</td></tr>
            </tbody>
          </table>
          <ul>
            <li>Lower bevel = quicker edge engagement and more precise feel.</li>
            <li>Higher bevel = more forgiving and easier to release from turns.</li>
            <li>Too much base bevel can make a ski feel sluggish or difficult to get onto an edge.</li>
          </ul>
          <p>For most recreational skiers, 0.5°–0.7° is a good range.</p>

          <h4>Side edge bevel (1°–5°)</h4>
          <p>
            The angle created when filing the side edge relative to a vertical, 90° edge. It determines how sharp and aggressive
            the edge is when the ski is engaged.
          </p>
          <table>
            <thead><tr><th>Side bevel</th><th>Performance</th></tr></thead>
            <tbody>
              <tr><td>1° (89° edge)</td><td>Less aggressive, more forgiving</td></tr>
              <tr><td>2° (88° edge)</td><td>Strong grip, excellent all-around performance</td></tr>
              <tr><td>3° (87° edge)</td><td>More aggressive grip, excellent for hard snow</td></tr>
              <tr><td>4° (86° edge)</td><td>Very aggressive, specialized tuning</td></tr>
              <tr><td>5° (85° edge)</td><td>Extremely aggressive, uncommon for recreational skis</td></tr>
            </tbody>
          </table>
          <ul>
            <li>Lower side bevel (1°) = more forgiving.</li>
            <li>Higher side bevel (3°–5°) = more aggressive edge bite and grip.</li>
            <li>More aggressive angles require better technique and more frequent edge maintenance.</li>
          </ul>
          <p>One important distinction: a 3° side bevel means the edge is 87° relative to the base, not 93°.</p>

          <h4>How the two angles work together</h4>
          <table>
            <thead><tr><th>Base</th><th>Side</th><th>Intended skier</th></tr></thead>
            <tbody>
              <tr><td>0.7°</td><td>1°</td><td>Beginner / forgiving</td></tr>
              <tr><td>0.7°</td><td>2°</td><td>Recreational all-mountain</td></tr>
              <tr><td>0.5°</td><td>2°</td><td>Intermediate / advanced</td></tr>
              <tr><td>0.5°</td><td>3°</td><td>Advanced / aggressive</td></tr>
              <tr><td>0.7°</td><td>3°</td><td>Performance-oriented all-mountain</td></tr>
            </tbody>
          </table>

          <div className="presets">
            {BEVEL_PRESETS.map((p) => (
              <div key={p.name} className="preset">
                <strong>{p.name}</strong>
                <span>Base {p.base}° · Side {p.side}°</span>
                <small>{p.note}</small>
                {onPreset && <button type="button" className="btn sm light" onClick={() => onPreset(p.base, p.side)}>Use this</button>}
              </div>
            ))}
          </div>

          <p className="caution">
            <strong>Pick once and stick with it.</strong> Edge angles aren&apos;t something to change every time your skis come in.
            Changing the base bevel in particular can mean removing a lot of base-edge material, and it&apos;s difficult to reverse.
            If your skis already have a bevel you like, choose that, or leave a note and we&apos;ll match what&apos;s on them.
          </p>
        </div>
      )}
    </div>
  );
}
