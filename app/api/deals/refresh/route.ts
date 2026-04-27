import { NextRequest, NextResponse } from 'next/server';
import { scrapeFlipp } from '@/lib/scrapers/flipp';
import { upsertDeals } from '@/lib/db/queries/deals';
import { clearAllDeals } from '@/lib/db/queries/shopping';
import { auth } from '@/auth';
import { getProfile } from '@/lib/db/queries/profiles';

// Default postal code if no user context (Montréal centre-ville)
const DEFAULT_POSTAL_CODE = 'H2X3Y7';

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  const isCron = verifyCronSecret(req);
  let userId: string | undefined;

  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    userId = session.user.id;
  }

  // Postal code: body param → user profile → default
  let postalCode = DEFAULT_POSTAL_CODE;
  try {
    const body = await req.json().catch(() => ({})) as { postalCode?: string };
    if (body.postalCode) {
      postalCode = body.postalCode;
    } else if (userId) {
      const profile = await getProfile(userId);
      if (profile?.postalCode) postalCode = profile.postalCode;
    }
  } catch {
    // no body
  }

  console.log(`[deals/refresh] Scraping Flipp for postal code: ${postalCode}`);

  // Clear all existing deals before re-scraping so stale/non-food data doesn't accumulate
  const cleared = await clearAllDeals();
  if (cleared > 0) console.log(`[deals/refresh] Cleared ${cleared} old deals`);

  let items;
  try {
    items = await scrapeFlipp(postalCode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deals/refresh] Flipp scrape failed:', msg);
    return NextResponse.json({ error: `Flipp scrape failed: ${msg}` }, { status: 502 });
  }

  if (items.length === 0) {
    return NextResponse.json({ warning: 'Flipp returned 0 food items', inserted: 0, updated: 0 });
  }

  let inserted = 0;
  let updated = 0;
  try {
    ({ inserted, updated } = await upsertDeals(items));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deals/refresh] upsertDeals failed:', msg);
    return NextResponse.json({ error: `DB upsert failed: ${msg}` }, { status: 500 });
  }

  console.log(`[deals/refresh] Done. inserted=${inserted} updated=${updated} cleared=${cleared}`);
  return NextResponse.json({ ok: true, scraped: items.length, inserted, updated, cleared, postalCode });
}

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
