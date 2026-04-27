import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes, recipeIngredients } from '@/lib/db/schema';
import type { ScrapedRecipe } from '@/lib/scrapers/ricardo';
import { normalizeIngredients } from '@/lib/normalize/ingredients';

export async function upsertRecipes(
  items: ScrapedRecipe[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Normalize all ingredient names in one batch per recipe set
  const allIngredientNames = [...new Set(items.flatMap((r) => r.ingredients.map((i) => i.name)))];
  const normMap = await normalizeIngredients(allIngredientNames);

  for (const item of items) {
    // Check if already in DB by source URL
    const [existing] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.sourceUrl, item.sourceUrl))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    const [recipe] = await db
      .insert(recipes)
      .values({
        source: item.source,
        sourceUrl: item.sourceUrl,
        title: item.title,
        servings: item.servings,
        prepTimeMin: item.prepTimeMin,
        cookTimeMin: item.cookTimeMin,
        instructions: item.instructions,
        tags: item.tags,
      })
      .returning({ id: recipes.id });

    if (item.ingredients.length > 0) {
      await db.insert(recipeIngredients).values(
        item.ingredients.map((ing) => ({
          recipeId: recipe.id,
          ingredientNormalized: normMap.get(ing.name)?.normalized ?? ing.name.toLowerCase(),
          quantity: ing.quantity != null ? String(ing.quantity) : null,
          unit: ing.unit,
          optional: ing.optional,
        }))
      );
    }

    inserted++;
  }

  return { inserted, skipped };
}

export async function getRecipesMatchingDeals(
  normalizedDealIngredients: string[],
  excludeTags: string[],
  limit = 5
): Promise<{ id: string; title: string; matchCount: number; totalIngredients: number }[]> {
  const dealSet = new Set(normalizedDealIngredients);

  // Fetch all recipes with their ingredients
  const allRecipes = await db.select({ id: recipes.id, title: recipes.title, tags: recipes.tags }).from(recipes);

  const scored = await Promise.all(
    allRecipes.map(async (r) => {
      if (r.tags.some((t) => excludeTags.includes(t))) return null;
      const ings = await db
        .select({ name: recipeIngredients.ingredientNormalized })
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, r.id));
      const matchCount = ings.filter((i) => dealSet.has(i.name)).length;
      return { ...r, matchCount, totalIngredients: ings.length };
    })
  );

  return scored
    .filter((r): r is NonNullable<typeof r> => r !== null && r.matchCount > 0)
    .sort((a, b) => b.matchCount / b.totalIngredients - a.matchCount / a.totalIngredients)
    .slice(0, limit);
}
