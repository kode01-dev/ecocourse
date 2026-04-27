import 'server-only';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

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

interface MealSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
}

interface MealDetail {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strSource: string | null;
  [key: string]: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`TheMealDB ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

function parseMeasure(measure: string): { quantity: number | null; unit: string | null } {
  const clean = measure.trim();
  if (!clean) return { quantity: null, unit: null };

  const match = clean.match(/^([\d./\s¼½¾⅓⅔]+)?\s*(.*)$/);
  if (!match) return { quantity: null, unit: clean || null };

  const qtyRaw = match[1]?.trim() ?? '';
  const unit = match[2]?.trim() || null;

  let quantity: number | null = null;
  if (qtyRaw) {
    const fractions: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };
    let num = 0;
    let raw = qtyRaw;
    for (const [k, v] of Object.entries(fractions)) {
      if (raw.includes(k)) { num += v; raw = raw.replace(k, ''); }
    }
    // Handle fractions like "1/2"
    if (raw.includes('/')) {
      const parts = raw.trim().split('/');
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b) && b !== 0) num += a / b;
      }
    } else {
      const plain = parseFloat(raw.trim());
      if (!isNaN(plain)) num += plain;
    }
    quantity = num > 0 ? parseFloat(num.toFixed(3)) : null;
  }

  return { quantity, unit };
}

function mealToRecipe(meal: MealDetail): ScrapedRecipe | null {
  if (!meal.strInstructions?.trim()) return null;

  const ingredients: ScrapedRecipe['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim() ?? '';
    if (!name) continue;
    const { quantity, unit } = parseMeasure(measure);
    ingredients.push({ name: name.toLowerCase(), quantity, unit, optional: false });
  }

  if (ingredients.length === 0) return null;

  const tags: string[] = [];
  if (meal.strCategory) tags.push(meal.strCategory.toLowerCase());
  if (meal.strArea) tags.push(meal.strArea.toLowerCase());
  if (meal.strTags) {
    meal.strTags.split(',').forEach((t) => {
      const trimmed = t.trim().toLowerCase();
      if (trimmed) tags.push(trimmed);
    });
  }

  return {
    title: meal.strMeal,
    sourceUrl: meal.strSource ?? `https://www.themealdb.com/meal/${meal.idMeal}`,
    source: 'ricardo',
    servings: 4,
    prepTimeMin: 15,
    cookTimeMin: 30,
    instructions: meal.strInstructions.trim(),
    tags: [...new Set(tags)].slice(0, 10),
    ingredients,
  };
}

async function getMealIdsByLetter(letter: string): Promise<string[]> {
  try {
    const data = await fetchJson<{ meals: MealSummary[] | null }>(
      `${BASE}/search.php?f=${letter}`
    );
    return (data.meals ?? []).map((m) => m.idMeal);
  } catch {
    return [];
  }
}

async function getMealDetail(id: string): Promise<MealDetail | null> {
  try {
    const data = await fetchJson<{ meals: MealDetail[] | null }>(
      `${BASE}/lookup.php?i=${id}`
    );
    return data.meals?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function scrapeTheMealDB(maxRecipes = 100): Promise<ScrapedRecipe[]> {
  const results: ScrapedRecipe[] = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  for (const letter of letters) {
    if (results.length >= maxRecipes) break;

    const ids = await getMealIdsByLetter(letter);
    console.log(`[TheMealDB] Letter '${letter}': ${ids.length} meals`);

    for (const id of ids) {
      if (results.length >= maxRecipes) break;

      const meal = await getMealDetail(id);
      if (!meal) continue;

      const recipe = mealToRecipe(meal);
      if (recipe) {
        results.push(recipe);
        console.log(`[TheMealDB] ✓ ${recipe.title} (${recipe.ingredients.length} ingredients)`);
      }
    }
  }

  console.log(`[TheMealDB] Total: ${results.length} recipes`);
  return results;
}
