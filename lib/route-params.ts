import { addDays, todayISO } from "./services";
import { ROUTE_TYPES, type RouteType } from "./invoices";

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Reads ?from=&to=&type= for the route sheet. Defaults to the next 7 days; a range is capped at 92 days. */
export function routeParams(sp: { from?: string; to?: string; type?: string }) {
  const today = todayISO();
  let from = isDate(sp.from) ? sp.from! : today;
  let to = isDate(sp.to) ? sp.to! : isDate(sp.from) ? sp.from! : addDays(today, 6);
  if (to < from) [from, to] = [to, from];
  if (to > addDays(from, 91)) to = addDays(from, 91);
  const type: RouteType = sp.type && sp.type in ROUTE_TYPES ? (sp.type as RouteType) : "all";
  const qs = new URLSearchParams({ from, to, type }).toString();
  return { from, to, type, qs, today };
}
