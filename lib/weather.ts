/**
 * Mountain conditions and destination forecasts from Open-Meteo (open-meteo.com).
 * No account or key is needed to start. Open-Meteo's free API is for non-commercial use;
 * for a business they ask you to take an API plan, then set OPEN_METEO_API_KEY and
 * requests switch to the customer endpoint automatically.
 */

export type Place = { name: string; region: string; lat: number; lon: number; elevation?: number };

/** Resorts customers are most likely to search, with summit-ish elevation (m) for snow numbers. */
export const RESORTS: Place[] = [
  { name: "Blue Hills Ski Area", region: "Canton, MA", lat: 42.218, lon: -71.115, elevation: 194 },
  { name: "Wachusett Mountain", region: "Princeton, MA", lat: 42.503, lon: -71.887, elevation: 611 },
  { name: "Nashoba Valley", region: "Westford, MA", lat: 42.544, lon: -71.444, elevation: 140 },
  { name: "Jiminy Peak", region: "Hancock, MA", lat: 42.556, lon: -73.293, elevation: 731 },
  { name: "Berkshire East", region: "Charlemont, MA", lat: 42.622, lon: -72.879, elevation: 553 },
  { name: "Gunstock", region: "Gilford, NH", lat: 43.543, lon: -71.367, elevation: 685 },
  { name: "Pats Peak", region: "Henniker, NH", lat: 43.178, lon: -71.808, elevation: 435 },
  { name: "Mount Sunapee", region: "Newbury, NH", lat: 43.331, lon: -72.08, elevation: 840 },
  { name: "Loon Mountain", region: "Lincoln, NH", lat: 44.036, lon: -71.621, elevation: 930 },
  { name: "Cannon Mountain", region: "Franconia, NH", lat: 44.156, lon: -71.699, elevation: 1240 },
  { name: "Waterville Valley", region: "Waterville Valley, NH", lat: 43.952, lon: -71.528, elevation: 1220 },
  { name: "Bretton Woods", region: "Bretton Woods, NH", lat: 44.258, lon: -71.441, elevation: 950 },
  { name: "Attitash", region: "Bartlett, NH", lat: 44.083, lon: -71.229, elevation: 717 },
  { name: "Wildcat Mountain", region: "Pinkham Notch, NH", lat: 44.264, lon: -71.239, elevation: 1248 },
  { name: "Cranmore", region: "North Conway, NH", lat: 44.056, lon: -71.11, elevation: 520 },
  { name: "Killington", region: "Killington, VT", lat: 43.604, lon: -72.82, elevation: 1293 },
  { name: "Pico Mountain", region: "Killington, VT", lat: 43.662, lon: -72.842, elevation: 1209 },
  { name: "Okemo", region: "Ludlow, VT", lat: 43.401, lon: -72.717, elevation: 1019 },
  { name: "Mount Snow", region: "West Dover, VT", lat: 42.96, lon: -72.92, elevation: 1095 },
  { name: "Stratton", region: "Stratton, VT", lat: 43.113, lon: -72.908, elevation: 1186 },
  { name: "Bromley", region: "Peru, VT", lat: 43.227, lon: -72.938, elevation: 994 },
  { name: "Sugarbush", region: "Warren, VT", lat: 44.136, lon: -72.894, elevation: 1245 },
  { name: "Stowe", region: "Stowe, VT", lat: 44.53, lon: -72.781, elevation: 1110 },
  { name: "Smugglers' Notch", region: "Jeffersonville, VT", lat: 44.588, lon: -72.79, elevation: 1109 },
  { name: "Jay Peak", region: "Jay, VT", lat: 44.938, lon: -72.505, elevation: 1209 },
  { name: "Sunday River", region: "Newry, ME", lat: 44.473, lon: -70.857, elevation: 948 },
  { name: "Sugarloaf", region: "Carrabassett Valley, ME", lat: 45.031, lon: -70.313, elevation: 1291 },
  { name: "Saddleback", region: "Rangeley, ME", lat: 44.936, lon: -70.506, elevation: 1256 },
  { name: "Whiteface", region: "Wilmington, NY", lat: 44.366, lon: -73.903, elevation: 1347 },
  { name: "Gore Mountain", region: "North Creek, NY", lat: 43.673, lon: -74.006, elevation: 1095 },
  { name: "Hunter Mountain", region: "Hunter, NY", lat: 42.177, lon: -74.23, elevation: 1231 },
  { name: "Mont Tremblant", region: "Quebec", lat: 46.209, lon: -74.585, elevation: 875 },
  { name: "Vail", region: "Colorado", lat: 39.606, lon: -106.355, elevation: 3527 },
  { name: "Breckenridge", region: "Colorado", lat: 39.481, lon: -106.067, elevation: 3914 },
  { name: "Park City", region: "Utah", lat: 40.651, lon: -111.508, elevation: 3049 },
  { name: "Jackson Hole", region: "Wyoming", lat: 43.587, lon: -110.828, elevation: 3185 },
  { name: "Mammoth Mountain", region: "California", lat: 37.651, lon: -119.027, elevation: 3369 },
  { name: "Whistler Blackcomb", region: "British Columbia", lat: 50.115, lon: -122.949, elevation: 2182 },
];

const WMO: Record<number, [string, string]> = {
  0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"], 56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Thunderstorm, hail", "⛈️"],
};
export const describe = (code: number | null | undefined) => WMO[code ?? -1] ?? ["—", "🌡️"];

/** Wax to match the snow: same four specs as the Basic tune. */
export function waxFor(tempF: number): "Warm" | "All Season" | "Cold" | "Polar" {
  if (tempF >= 25) return "Warm";
  if (tempF >= 14) return "All Season";
  if (tempF >= 0) return "Cold";
  return "Polar";
}

export function searchResorts(q: string, limit = 8): Place[] {
  const t = q.trim().toLowerCase();
  if (!t) return RESORTS.slice(0, limit);
  return RESORTS.filter((r) => `${r.name} ${r.region}`.toLowerCase().includes(t)).slice(0, limit);
}

function base(host: "api" | "geocoding-api") {
  const key = process.env.OPEN_METEO_API_KEY;
  return key ? { url: `https://customer-${host}.open-meteo.com/v1`, key: `&apikey=${encodeURIComponent(key)}` } : { url: `https://${host}.open-meteo.com/v1`, key: "" };
}

async function getJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
  return res.json();
}

/** Free-text place search (towns, mountains) via Open-Meteo geocoding. */
export async function geocode(q: string, limit = 5): Promise<Place[]> {
  const b = base("geocoding-api");
  const data = await getJson(`${b.url}/search?name=${encodeURIComponent(q.trim())}&count=${limit}&language=en&format=json${b.key}`);
  return ((data.results ?? []) as { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number; elevation?: number }[]).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country_code].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    elevation: r.elevation,
  }));
}

export type DayForecast = { date: string; code: number; summary: string; icon: string; hi: number; lo: number; snowIn: number; precipIn: number; precipPct: number | null; windMph: number };
export type Conditions = {
  place: Place;
  now: { tempF: number; feelsF: number; windMph: number; gustMph: number; code: number; summary: string; icon: string };
  snowDepthIn: number | null;
  snow24In: number;
  snow7dIn: number;
  next3In: number;
  wax: ReturnType<typeof waxFor>;
  days: DayForecast[];
  updated: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Current conditions, recent snowfall and a 7-day forecast for one place. */
export async function weatherFor(place: Place): Promise<Conditions> {
  const b = base("api");
  const q = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m",
    hourly: "snowfall,snow_depth",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    past_days: "7",
    forecast_days: "7",
  });
  if (place.elevation) q.set("elevation", String(place.elevation));
  const d = await getJson(`${b.url}/forecast?${q}${b.key}`);

  // Snowfall is in cm and depth in m (metric) so the conversions here don't depend on unit flags.
  const times: string[] = d.hourly?.time ?? [];
  const snowfall: (number | null)[] = d.hourly?.snowfall ?? [];
  const depth: (number | null)[] = d.hourly?.snow_depth ?? [];
  const nowIdx = Math.max(0, times.findLastIndex((t) => t <= d.current.time));
  const sum = (from: number, to: number) => snowfall.slice(Math.max(0, from), Math.max(0, to)).reduce<number>((s, v) => s + (v ?? 0), 0);
  const cmToIn = (cm: number) => r1(cm / 2.54);

  const daily = d.daily;
  const today = String(d.current.time).slice(0, 10);
  const days: DayForecast[] = (daily.time as string[]).map((date, i) => ({
    date,
    code: daily.weather_code[i],
    summary: describe(daily.weather_code[i])[0],
    icon: describe(daily.weather_code[i])[1],
    hi: Math.round(daily.temperature_2m_max[i]),
    lo: Math.round(daily.temperature_2m_min[i]),
    snowIn: cmToIn(daily.snowfall_sum[i] ?? 0),
    precipIn: r1((daily.precipitation_sum[i] ?? 0) / 25.4),
    precipPct: daily.precipitation_probability_max?.[i] ?? null,
    windMph: Math.round(daily.wind_speed_10m_max[i] ?? 0),
  })).filter((x) => x.date >= today);

  const depthM = depth[nowIdx];
  return {
    place,
    now: {
      tempF: Math.round(d.current.temperature_2m),
      feelsF: Math.round(d.current.apparent_temperature),
      windMph: Math.round(d.current.wind_speed_10m),
      gustMph: Math.round(d.current.wind_gusts_10m),
      code: d.current.weather_code,
      summary: describe(d.current.weather_code)[0],
      icon: describe(d.current.weather_code)[1],
    },
    snowDepthIn: depthM == null ? null : Math.round(depthM * 39.37),
    snow24In: cmToIn(sum(nowIdx - 23, nowIdx + 1)),
    snow7dIn: cmToIn(sum(nowIdx - 167, nowIdx + 1)),
    next3In: cmToIn(sum(nowIdx + 1, nowIdx + 73)),
    wax: waxFor(days[0] ? (days[0].hi + days[0].lo) / 2 : d.current.temperature_2m),
    days,
    updated: d.current.time,
  };
}
