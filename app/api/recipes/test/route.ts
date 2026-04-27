import { NextResponse } from 'next/server';

export async function GET() {
  const steps: Record<string, unknown> = {};

  // Step 1: fetch sitemap
  const sitemapUrl = 'https://www.ricardocuisine.com/sitemap.recipes-fr.1.xml';
  let xml = '';
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcoCourse/1.0)' },
      cache: 'no-store',
    });
    steps.sitemapStatus = res.status;
    steps.sitemapOk = res.ok;
    xml = await res.text();
    steps.sitemapSize = xml.length;
  } catch (e) {
    steps.sitemapError = String(e);
    return NextResponse.json({ steps });
  }

  // Step 2: extract URLs
  const matches = xml.match(/<loc>(https:\/\/www\.ricardocuisine\.com\/recettes\/[^<]+)<\/loc>/g) ?? [];
  steps.urlCount = matches.length;
  const firstUrl = matches[0]?.replace(/<\/?loc>/g, '');
  steps.firstUrl = firstUrl;

  if (!firstUrl) return NextResponse.json({ steps });

  // Step 3: fetch one recipe page
  let html = '';
  try {
    const res = await fetch(firstUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'fr-CA,fr;q=0.9',
      },
      cache: 'no-store',
    });
    steps.recipePageStatus = res.status;
    steps.recipePageOk = res.ok;
    html = await res.text();
    steps.recipePageSize = html.length;
  } catch (e) {
    steps.recipePageError = String(e);
    return NextResponse.json({ steps });
  }

  // Step 4: extract JSON-LD
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  steps.jsonLdBlocks = blocks.length;

  for (const block of blocks) {
    const content = block.replace(/<script[^>]+>/i, '').replace(/<\/script>/i, '').trim();
    try {
      const data = JSON.parse(content);
      if (data['@type'] === 'Recipe') {
        steps.recipeFound = true;
        steps.recipeName = data.name;
        steps.recipeIngredientCount = (data.recipeIngredient ?? []).length;
        steps.recipeIngredientSample = (data.recipeIngredient ?? []).slice(0, 3);
        steps.prepTime = data.prepTime;
        break;
      }
    } catch {
      steps.jsonLdParseError = content.slice(0, 100);
    }
  }

  return NextResponse.json({ ok: true, steps });
}
