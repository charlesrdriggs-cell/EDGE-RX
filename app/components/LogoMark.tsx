// Edge RX "Bevel Peak" mark: a sharp summit in a circle, with a bevel facet
// down its right face like a freshly sharpened edge.
// Source artwork lives in the project's logos/bevel-peak folder.

type Props = {
  size?: number;
  /** Circle color. */
  bg?: string;
  /** Mountain color. */
  peak?: string;
  /** Bevel facet color. Omit for the one-color version (shown as a cut line). */
  bevel?: string;
  className?: string;
};

export default function LogoMark({ size = 28, bg = "#fff", peak = "#0E2A47", bevel = "#E5432D", className }: Props) {
  const id = `edge-rx-clip-${size}-${(bg + peak + (bevel || "")).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden className={className}>
      <defs>
        <clipPath id={id}>
          <circle cx="100" cy="100" r="94" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="94" fill={bg} />
      <g clipPath={`url(#${id})`}>
        <path d="M-10 200 L50 118 L64 132 L94 40 L210 200 Z" fill={peak} />
        {bevel ? (
          <path d="M94 40 L210 200 L184 200 Z" fill={bevel} />
        ) : (
          <path d="M94 40 L184 200" stroke={bg} strokeWidth="7" />
        )}
      </g>
      <circle cx="100" cy="100" r="91" fill="none" stroke={bg} strokeWidth="6" />
    </svg>
  );
}
