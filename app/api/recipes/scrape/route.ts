import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scrapeTheMealDB } from '@/lib/scrapers/themealdb';
import { upsertRecipes } from '@/lib/db/queries/recipes';

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  const isCron = verifyCronSecret(req);
  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }

  let maxRecipes = 100;
  try {
    const body = await req.json().catch(() => ({})) as { maxRecipes?: number };
    if (body.maxRecipes) maxRecipes = Math.min(body.maxRecipes, 300);
  } catch {
    // use defaults
  }

  console.log(`[recipes/scrape] Starting TheMealDB scrape (maxRecipes=${maxRecipes})`);

  let scraped;
  try {
    scraped = await scrapeTheMealDB(maxRecipes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[recipes/scrape] TheMealDB scrape failed:', msg);
    return NextResponse.json({ error: `TheMealDB scrape failed: ${msg}` }, { status: 502 });
  }

  const { inserted, skipped } = await upsertRecipes(scraped);

  console.log(`[recipes/scrape] Done. scraped=${scraped.length} inserted=${inserted} skipped=${skipped}`);
  return NextResponse.json({
    ok: true,
    scraped: scraped.length,
    inserted,
    skipped,
    titles: scraped.slice(0, 5).map((r) => r.title), // preview first 5 for debugging
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
