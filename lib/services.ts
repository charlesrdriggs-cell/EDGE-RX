export type ServiceId = "basic" | "race";

export const WAX_SPECS = ["Warm", "All Season", "Cold", "Polar"] as const;
export const BASE_BEVELS = ["0.5", "0.6", "0.7"] as const;
export const SIDE_EDGES = ["1", "2", "3", "4", "5"] as const;

export const SERVICES: Record<
  ServiceId,
  { id: ServiceId; name: string; priceCents: number; tagline: string; includes: string[] }
> = {
  basic: {
    id: "basic",
    name: "Basic Ski Tune",
    priceCents: 5000,
    tagline: "Everything your skis need for a great weekend.",
    includes: [
      "Stone grind",
      "Edge sharpen & bevel",
      "Hot hand wax to spec: Warm, All Season, Cold or Polar",
      "Pick up & drop off included",
    ],
  },
  race: {
    id: "race",
    name: "Race Day Tune",
    priceCents: 6500,
    tagline: "Precision prep for race day and the fastest skiers.",
    includes: [
      "Sidewall, base & edge grind",
      "Base bevel to spec: 0.5° to 0.7°",
      "Side edge to spec: 1° to 5°",
      "Diamond polish",
      "Tip & tail burr removal",
      "Base clean & racing wax",
      "Pick up & drop off included",
    ],
  },
};

export const BASE_REPAIR = { name: "Minor base repair", priceCents: 1500 };

export function orderPrice(service: ServiceId, baseRepair: boolean) {
  return SERVICES[service].priceCents + (baseRepair ? BASE_REPAIR.priceCents : 0);
}

export function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export const STATUSES = [
  "scheduled",
  "picked_up",
  "in_progress",
  "ready",
  "returned",
  "cancelled",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked up",
  in_progress: "In progress",
  ready: "Ready",
  returned: "Returned",
  cancelled: "Cancelled",
};

export function specSummary(o: {
  service: string;
  wax_spec: string | null;
  base_bevel: string | null;
  side_edge: string | null;
  base_repair: number;
}) {
  const parts: string[] = [];
  if (o.service === "basic" && o.wax_spec) parts.push(`${o.wax_spec} wax`);
  if (o.service === "race") {
    if (o.base_bevel) parts.push(`Base ${o.base_bevel}°`);
    if (o.side_edge) parts.push(`Side ${o.side_edge}°`);
    parts.push("Racing wax");
  }
  if (o.base_repair) parts.push("+ Base repair");
  return parts.join(" · ");
}

/** Format YYYY-MM-DD as e.g. "Sat, Dec 6" without timezone drift. */
export function fmtDate(d: string | null | undefined, withYear = false) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export function todayISO() {
  const tz = process.env.BUSINESS_TIMEZONE || "America/Denver";
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
