import { getImage } from "@/lib/media";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = getImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(img.data), {
    headers: {
      "Content-Type": img.mime,
      // Ids are random and never reused, so the browser can cache forever
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
