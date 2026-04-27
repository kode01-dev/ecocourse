import 'server-only';

const BASE = 'https://www.ricardocuisine.com';
const RATE_LIMIT_MS = 1200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (compatible; EcoCourse/1.0; mailto:emile.d@prosomo.com)',
      'Accept-Language': 'fr-CA,fr;q=0.9',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

export interface ScrapedRecipe {
  title: string;
  sourceUrl: string;
  source: 'ricardo';
  servings: number;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  instructions: string;
  tags: string[];
  ingredients: {
    name: string;
    quantity: number | null;
    unit: string | null;
    optional: boolean;
  }[];
}

// Parse ISO 8601 duration like PT25M, PT1H30M
function parseDuration(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hours = iso.match(/(\d+)H/);
  const mins = iso.match(/(\d+)M/);
  const total = (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0);
  return total > 0 ? total : null;
}

// Parse "500 g de beurre" → { name, quantity, unit }
function parseIngredient(text: string): { name: string; quantity: number | null; unit: string | null } {
  const clean = text.trim().replace(/\s+/g, ' ');

  // Match: optional number + optional unit + "de/d'" + ingredient name
  const match = clean.match(
    /^([\d,./\s¼½¾⅓⅔]+)?\s*(ml|L|g|kg|oz|lb|tasse|tasses|c\.\s*à\s*soupe|c\.\s*à\s*thé|pincée|branche|branches|gousse|gousses|tranche|tranches|paquet|paq\.|dz|boîte|boîtes|sac|sachet)?\s*(?:de\s+|d['']\s*)?(.+)$/i
  );

  if (!match) return { name: clean.toLowerCase(), quantity: null, unit: null };

  const qtyRaw = match[1]?.trim().replace(',', '.') ?? '';
  const unit = match[2]?.trim() ?? null;
  const name = (match[3] ?? clean).trim().toLowerCase();

  let quantity: number | null = null;
  if (qtyRaw) {
    const fractions: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };
    let num = 0;
    let raw = qtyRaw;
    for (const [k, v] of Object.entries(fractions)) {
      if (raw.includes(k)) { num += v; raw = raw.replace(k, ''); }
    }
    const plain = parseFloat(raw.trim());
    if (!isNaN(plain)) num += plain;
    quantity = num > 0 ? parseFloat(num.toFixed(3)) : null;
  }

  return { name, quantity, unit };
}

// Fetch recipe URLs from the French sitemap
async function getRecipeUrlsFromSitemap(sitemapIndex = 1): Promise<string[]> {
  const url = `${BASE}/sitemap.recipes-fr.${sitemapIndex}.xml`;
  let xml: string;
  try {
    xml = await fetchText(url);
  } catch (e) {
    console.error(`[Ricardo] Sitemap fetch failed (page ${sitemapIndex}):`, e);
    return [];
  }
  const matches = xml.match(/<loc>(https:\/\/www\.ricardocuisine\.com\/recettes\/[^<]+)<\/loc>/g) ?? [];
  console.log(`[Ricardo] Sitemap page ${sitemapIndex}: ${matches.length} URLs (xml size: ${xml.length})`);
  return matches.map((m) => m.replace(/<\/?loc>/g, ''));
}

// Scrape a single recipe page via its JSON-LD
async function scrapeRecipePage(url: string): Promise<ScrapedRecipe | null> {
  let html: string;
  try {
    html = await fetchText(url);
  } catch (e) {
    console.warn(`[Ricardo] Failed: ${url}`, e);
    return null;
  }

  // Extract JSON-LD blocks
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const block of blocks) {
    const content = block.replace(/<script[^>]+>/i, '').replace(/<\/script>/i, '').trim();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(content);
    } catch {
      continue;
    }

    if (data['@type'] !== 'Recipe') continue;

    const title = (data['name'] as string | undefined)?.trim();
    if (!title) return null;

    const prepTimeMin = parseDuration(data['prepTime'] as string | undefined);
    const cookTimeMin = parseDuration(data['cookTime'] as string | undefined);

    // Servings
    const yieldRaw = data['recipeYield'] as string | number | undefined;
    const servings = yieldRaw ? (parseInt(String(yieldRaw)) || 4) : 4;

    // Instructions
    const instrRaw = data['recipeInstructions'];
    let instructions = '';
    if (Array.isArray(instrRaw)) {
      instructions = instrRaw
        .map((step: unknown) =>
          typeof step === 'string' ? step : (step as { text?: string })?.text ?? ''
        )
        .filter(Boolean)
        .join('\n');
    } else if (typeof instrRaw === 'string') {
      instructions = instrRaw;
    }
    if (!instructions) return null;

    // Ingredients
    const ingRaw = (data['recipeIngredient'] as string[] | undefined) ?? [];
    const ingredients = ingRaw
      .map((raw) => {
        const optional = /facultatif|optionnel/i.test(raw);
        const cleaned = raw.replace(/\(facultatif\)|\(optionnel\)/gi, '').trim();
        const { name, quantity, unit } = parseIngredient(cleaned);
        return { name, quantity, unit, optional };
      })
      .filter((i) => i.name.length > 1);

    if (ingredients.length === 0) return null;

    // Tags from keywords + category
    const keywords = data['keywords'] as string | undefined;
    const category = data['recipeCategory'] as string | string[] | undefined;
    const tagSet = new Set<string>();
    if (keywords) keywords.split(',').forEach((k) => tagSet.add(k.trim().toLowerCase()));
    if (category) {
      (Array.isArray(category) ? category : [category]).forEach((c) => tagSet.add(c.trim().toLowerCase()));
    }
    const tags = [...tagSet].filter((t) => t.length > 0 && t.length < 60).slice(0, 10);

    return {
      title,
      sourceUrl: url,
      source: 'ricardo',
      servings,
      prepTimeMin,
      cookTimeMin,
      instructions,
      tags,
      ingredients,
    };
  }

  return null;
}

export async function scrapeRicardoRecipes(
  maxPages = 3,
  maxRecipes = 50
): Promise<ScrapedRecipe[]> {
  const results: ScrapedRecipe[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages && results.length < maxRecipes; page++) {
    const urls = await getRecipeUrlsFromSitemap(page);
    console.log(`[Ricardo] Sitemap page ${page}: ${urls.length} URLs`);
    if (urls.length === 0) break;

    // Focus on plats principaux — filter by URL keywords for main dishes
    const mainDishUrls = urls.filter((url) => {
      const slug = url.toLowerCase();
      // Prefer main dish keywords; skip desserts and drinks
      const isMainDish = !slug.includes('gateau') && !slug.includes('muffin') &&
        !slug.includes('biscuit') && !slug.includes('cafe') &&
        !slug.includes('cocktail') && !slug.includes('limonade') &&
        !slug.includes('sucre') && !slug.includes('caramel') &&
        !slug.includes('chocolat') && !slug.includes('brownie');
      return isMainDish;
    });

    const toScrape = mainDishUrls.slice(0, maxRecipes - results.length);

    for (const url of toScrape) {
      if (seen.has(url) || results.length >= maxRecipes) break;
      seen.add(url);
      await sleep(RATE_LIMIT_MS);

      const recipe = await scrapeRecipePage(url);
      if (recipe) {
        results.push(recipe);
        console.log(`[Ricardo] ✓ ${recipe.title} (${recipe.ingredients.length} ingrédients)`);
      }
    }

    await sleep(RATE_LIMIT_MS * 2);
  }

  console.log(`[Ricardo] Total: ${results.length} recettes`);
  return results;
}
