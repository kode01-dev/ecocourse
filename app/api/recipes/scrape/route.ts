import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scrapeRicardoRecipes } from '@/lib/scrapers/ricardo';
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

  let maxPages = 3;
  let maxRecipes = 30;
  try {
    const body = await req.json().catch(() => ({})) as { maxPages?: number; maxRecipes?: number };
    if (body.maxPages) maxPages = Math.min(body.maxPages, 10);
    if (body.maxRecipes) maxRecipes = Math.min(body.maxRecipes, 100);
  } catch {
    // use defaults
  }

  console.log(`[recipes/scrape] Starting Ricardo scrape (maxPages=${maxPages}, maxRecipes=${maxRecipes})`);

  let scraped;
  try {
    scraped = await scrapeRicardoRecipes(maxPages, maxRecipes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[recipes/scrape] Ricardo scrape failed:', msg);
    return NextResponse.json({ error: `Ricardo scrape failed: ${msg}` }, { status: 502 });
  }

  const { inserted, skipped } = await upsertRecipes(scraped);

  console.log(`[recipes/scrape] Done. scraped=${scraped.length} inserted=${inserted} skipped=${skipped}`);
  return NextResponse.json({ ok: true, scraped: scraped.length, inserted, skipped });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
