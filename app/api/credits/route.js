import { getAccountInfo } from "@/lib/serpapi.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits — free-tier credit meter for the footer badge.
 * account.json costs no searches; the lib caches it for 1h.
 * { ok: false } when no key is configured (badge hides itself).
 */
export async function GET() {
  try {
    const info = await getAccountInfo();
    if (!info) return Response.json({ ok: false });
    return Response.json({ ok: true, ...info });
  } catch {
    return Response.json({ ok: false });
  }
}
