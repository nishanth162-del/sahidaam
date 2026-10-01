import { lensIdentify } from "@/lib/serpapi.js";

export const dynamic = "force-dynamic";

/** POST /api/identify { imageUrl } -> product name via Google Lens. */
export async function POST(request) {
  try {
    const { imageUrl } = await request.json();
    if (!imageUrl) return Response.json({ error: "Missing imageUrl" }, { status: 400 });
    const result = await lensIdentify(imageUrl);
    return Response.json(result);
  } catch (e) {
    const status = e.message.includes("SERPAPI_KEY") ? 503 : 502;
    return Response.json({ error: e.message }, { status });
  }
}
