import { NextRequest, NextResponse } from 'next/server';
import { scrapeFlipp } from '@/lib/scrapers/flipp';
import { upsertDeals } from '@/lib/db/queries/deals';
import { getProfile } from '@/lib/db/queries/profiles';
import { auth } from '@/auth';

// Default postal code if no user context (Montréal centre-ville)
const DEFAULT_POSTAL_CODE = 'H2X3Y7';

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// POST /api/deals/refresh
// Called by Vercel Cron every Thursday at 8am ET, or manually by admin.
// Auth: either CRON_SECRET header (cron job) or logged-in user (manual trigger).
export async function POST(req: NextRequest) {
  const isCron = verifyCronSecret(req);

  if (!isCron) {
    // Fall back to session auth for manual trigger from admin UI
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }

  // Postal code: use body param or default
  let postalCode = DEFAULT_POSTAL_CODE;
  try {
    const body = await req.json().catch(() => ({})) as { postalCode?: string };
    if (body.postalCode) postalCode = body.postalCode;
  } catch {
    // no body — use default
  }

  console.log(`[deals/refresh] Starting scrape for postal code: ${postalCode}`);

  let items;
  try {
    items = await scrapeFlipp(postalCode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deals/refresh] Flipp scrape failed:', msg);
    return NextResponse.json({ error: `Flipp scrape failed: ${msg}` }, { status: 502 });
  }

  if (items.length === 0) {
    return NextResponse.json({ warning: 'Flipp returned 0 items', inserted: 0, updated: 0 });
  }

  const { inserted, updated } = await upsertDeals(items);

  console.log(`[deals/refresh] Done. inserted=${inserted} updated=${updated}`);
  return NextResponse.json({
    ok: true,
    scraped: items.length,
    inserted,
    updated,
    postalCode,
  });
}

// GET — health check / manual trigger from browser for dev
export async function GET(req: NextRequest) {
  const isCron = verifyCronSecret(req);
  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }
  return POST(req);
}
