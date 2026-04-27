import 'server-only';
import { parse } from 'node-html-parser';

const BASE = 'https://www.ricardocuisine.com';
const RATE_LIMIT_MS = 1200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EcoCourse/1.0; mailto:emile.d@prosomo.com)',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-CA,fr;q=0.9',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
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

function parseTime(text: string | null | undefined): number | null {
  if (!text) return null;
  const hours = text.match(/(\d+)\s*h/i);
  const mins = text.match(/(\d+)\s*min/i);
  return (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0) || null;
}

function parseQuantity(text: string): { quantity: number | null; unit: string | null; name: string } {
  // Examples: "500 g de beurre", "2 tasses de farine", "1 oignon"
  const match = text.match(/^([\d\s\/¼½¾⅓⅔]+)?\s*(tasse|tasses|ml|L|g|kg|oz|lb|c\. à soupe|c\. à thé|pincée|poignée|branche|branches|gousses?|tranches?|unités?|pkg|paquet|dz)?\s*(?:de\s+|d[''])?(.+)$/i);
  if (!match) return { quantity: null, unit: null, name: text.trim() };
  const qtyRaw = match[1]?.trim();
  const unit = match[2]?.trim() ?? null;
  const name = match[3]?.trim() ?? text.trim();
  let quantity: number | null = null;
  if (qtyRaw) {
    const fractions: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };
    let num = 0;
    for (const [k, v] of Object.entries(fractions)) {
      if (qtyRaw.includes(k)) { num += v; }
    }
    const plain = parseFloat(qtyRaw.replace(/[¼½¾⅓⅔]/g, ''));
    if (!isNaN(plain)) num += plain;
    quantity = num > 0 ? num : null;
  }
  return { quantity, unit, name };
}

async function scrapeRecipePage(url: string): Promise<ScrapedRecipe | null> {
  let html: string;
  try {
    html = await fetchPage(url);
  } catch (e) {
    console.warn(`[Ricardo] Failed to fetch ${url}:`, e);
    return null;
  }

  const root = parse(html);

  const title = root.querySelector('h1')?.text?.trim();
  if (!title) return null;

  // Servings
  const servingsEl = root.querySelector('[class*="servings"] [class*="value"], [data-servings], .recipe-servings');
  const servings = parseInt(servingsEl?.text ?? '4') || 4;

  // Times
  const prepEl = root.querySelector('[class*="prep"], [itemprop="prepTime"]');
  const cookEl = root.querySelector('[class*="cook"], [itemprop="cookTime"]');
  const prepTimeMin = parseTime(prepEl?.text);
  const cookTimeMin = parseTime(cookEl?.text);

  // Tags
  const tagEls = root.querySelectorAll('[class*="tag"], [class*="category"], [itemprop="keywords"]');
  const tags = [...new Set(
    tagEls.map((el) => el.text.trim().toLowerCase()).filter((t) => t.length > 0 && t.length < 50)
  )].slice(0, 10);

  // Instructions
  const instrEls = root.querySelectorAll('[class*="instruction"] li, [class*="step"] li, [itemprop="recipeInstructions"] li');
  let instructions = instrEls.map((el) => el.text.trim()).filter(Boolean).join('\n');
  if (!instructions) {
    const instrBlock = root.querySelector('[class*="instruction"], [class*="directions"], [itemprop="recipeInstructions"]');
    instructions = instrBlock?.text?.trim() ?? '';
  }
  if (!instructions) return null;

  // Ingredients
  const ingEls = root.querySelectorAll('[class*="ingredient"] li, [itemprop="recipeIngredient"]');
  const ingredients = ingEls.map((el) => {
    const text = el.text.trim();
    const optional = /facultatif|optionnel/i.test(text);
    const { quantity, unit, name } = parseQuantity(text.replace(/\(facultatif\)|\(optionnel\)/gi, '').trim());
    return { name, quantity, unit, optional };
  }).filter((ing) => ing.name.length > 0);

  if (ingredients.length === 0) return null;

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

// Fetch recipe URLs from listing pages
async function getRecipeUrls(page: number): Promise<string[]> {
  const url = `${BASE}/recettes?page=${page}`;
  let html: string;
  try {
    html = await fetchPage(url);
  } catch {
    return [];
  }

  const root = parse(html);
  const links = root.querySelectorAll('a[href*="/recettes/"]');
  const urls = [...new Set(
    links
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.match(/\/recettes\/\d+/))
      .map((href) => href.startsWith('http') ? href : `${BASE}${href}`)
  )];
  return urls;
}

export async function scrapeRicardoRecipes(
  maxPages = 3,
  maxRecipes = 30
): Promise<ScrapedRecipe[]> {
  const results: ScrapedRecipe[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages && results.length < maxRecipes; page++) {
    const urls = await getRecipeUrls(page);
    console.log(`[Ricardo] Page ${page}: found ${urls.length} recipe URLs`);

    for (const url of urls) {
      if (seen.has(url) || results.length >= maxRecipes) break;
      seen.add(url);
      await sleep(RATE_LIMIT_MS);
      const recipe = await scrapeRecipePage(url);
      if (recipe) {
        results.push(recipe);
        console.log(`[Ricardo] Scraped: ${recipe.title}`);
      }
    }

    await sleep(RATE_LIMIT_MS);
  }

  return results;
}
