import { NextResponse } from "next/server";
import { geocode, searchResorts, weatherFor, type Place } from "@/lib/weather";

/**
 * GET /api/weather?search=stowe&kind=resort|place  -> { places: Place[] }
 * GET /api/weather?lat=..&lon=..&name=..&region=..&elevation=..  -> Conditions
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const search = (sp.get("search") ?? "").slice(0, 80);
  try {
    if (sp.has("search")) {
      const kind = sp.get("kind") === "place" ? "place" : "resort";
      let places: Place[] = kind === "resort" ? searchResorts(search) : [];
      if (search.trim().length >= 2 && (kind === "place" || places.length === 0)) {
        places = [...places, ...(await geocode(search))];
      }
      return NextResponse.json({ places });
    }
    const lat = Number(sp.get("lat")), lon = Number(sp.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "Pick a place first." }, { status: 400 });
    }
    const elevation = Number(sp.get("elevation"));
    const place: Place = {
      name: (sp.get("name") ?? "Selected place").slice(0, 80),
      region: (sp.get("region") ?? "").slice(0, 80),
      lat, lon,
      elevation: Number.isFinite(elevation) && elevation > 0 ? elevation : undefined,
    };
    return NextResponse.json(await weatherFor(place), { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (err) {
    console.error("[weather]", (err as Error).message);
    return NextResponse.json({ error: "The weather service isn't answering right now. Try again in a minute." }, { status: 502 });
  }
}
