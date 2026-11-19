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
    name: "Basic Ski & Snowboard Tune",
    priceCents: 5000,
    tagline: "Everything your skis or snowboard need for a great weekend.",
    includes: [
      "Skis or snowboards",
      "Stone grind",
      "Edge sharpen & bevel",
      "Hot hand wax to spec: Warm, All Season, Cold or Polar",
      "Pick up & drop off included",
    ],
  },
  race: {
    id: "race",
    name: "Performance/Race Day Tune",
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

/** At-home "Learn to Tune" session. Booked separately from gear tunes (no pickup). */
export const LESSON = {
  name: "Learn to Tune Session",
  priceCents: 20000,
  length: "1.5 hours",
  tagline: "We come to your house, bring our equipment, and teach you how to tune.",
  proTip: "We can get a family of 4 done while you learn, for the same cost.",
};

/** #SKIFAST ski team promotion: a Performance/Race Day Tune for a registered racer. */
export const SKIFAST = { name: "#SKIFAST Ski Team Tune", priceCents: 4000 };

/** Current prices in cents. Defaults come from the constants above; the operator can override them in the dashboard. */
export type Prices = { basic: number; race: number; repair: number; lesson: number; skifast: number };
export const DEFAULT_PRICES: Prices = {
  basic: SERVICES.basic.priceCents,
  race: SERVICES.race.priceCents,
  repair: BASE_REPAIR.priceCents,
  lesson: LESSON.priceCents,
  skifast: SKIFAST.priceCents,
};

/** Price of one piece. A #SKIFAST racer's Performance/Race Day Tune is charged at the team price. */
export function orderPrice(service: ServiceId, baseRepair: boolean, prices: Prices = DEFAULT_PRICES, skifast = false) {
  const tune = service === "race" && skifast ? prices.skifast : prices[service];
  return tune + (baseRepair ? prices.repair : 0);
}

/** Minimum notice for a pickup or an at-home session. */
export const NOTICE_DAYS = 2;

/** Most pieces of gear in one pickup. */
export const MAX_PIECES = 12;

/** What an existing order was charged per line (falls back to defaults for orders made before prices were stored). */
export function orderLines(o: { service: ServiceId; base_repair: number; service_cents?: number | null; repair_cents?: number | null }) {
  return {
    service: o.service_cents ?? DEFAULT_PRICES[o.service],
    repair: o.base_repair ? (o.repair_cents ?? DEFAULT_PRICES.repair) : 0,
  };
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
  racer_name?: string | null;
}) {
  const parts: string[] = [];
  if (o.racer_name) parts.push(`#SKIFAST: ${o.racer_name}`);
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
  const tz = process.env.BUSINESS_TIMEZONE || "America/New_York";
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
