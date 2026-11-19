import { currentUser } from "@/lib/auth";
import { selectTagOrders, buildTags, tagsToZpl } from "@/lib/tags";

/** GET /admin/tags/zpl?date=…|id=…|group=…&dpi=203|300 -> a .zpl file to send straight to a Zebra printer. */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "operator") return new Response("Not allowed", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { orders } = selectTagOrders(sp);
  const dpi = sp.dpi === "300" ? 300 : 203;
  const name = sp.group ? `pickup-${sp.group}` : sp.id ? `tag-${sp.id}` : sp.date ? `pickups-${sp.date}` : "active";
  return new Response(tagsToZpl(buildTags(orders), dpi), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="edge-rx-tags-${name}-${dpi}dpi.zpl"`,
      "Cache-Control": "no-store",
    },
  });
}
