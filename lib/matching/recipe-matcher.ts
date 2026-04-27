import 'server-only';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipes, recipeIngredients } from '@/lib/db/schema';

export interface DealItem {
  dealId: string;
  productId: string;
  name: string; // normalized product name
  category: string | null;
  price: string;
  regularPrice: string | null;
  storeId: string;
  storeName: string;
  unit: string | null;
}

export interface RecipeMatch {
  recipeId: string;
  title: string;
  servings: number;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  sourceUrl: string | null;
  matchCount: number;       // # ingredients covered by deals
  totalIngredients: number;
  matchPct: number;         // matchCount / totalIngredients
  ingredients: IngredientWithDeal[];
}

export interface IngredientWithDeal {
  ingredientNormalized: string;
  quantity: string | null;
  unit: string | null;
  optional: boolean;
  deal: DealItem | null;    // best deal for this ingredient, or null if not on sale
}

// Fuzzy match: does a deal product name cover a recipe ingredient?
// e.g. "poulet" matches "poitrine de poulet désossée", "poulet entier", etc.
// e.g. "tomates en conserve" matches "tomate"
function ingredientMatchesDeal(ingredient: string, dealName: string): boolean {
  const ing = ingredient.toLowerCase().trim();
  const deal = dealName.toLowerCase().trim();

  // Direct substring match in either direction
  if (deal.includes(ing) || ing.includes(deal)) return true;

  // Stem matching: strip common suffixes and try again
  const ingRoot = ing
    .replace(/s$/, '')           // plural
    .replace(/es$/, '')
    .replace(/aux$/, 'al')       // légumes → légume
    .replace(/ées?$/, 'er')      // émincée → émincer (skip)
    .trim();

  const dealRoot = deal
    .replace(/s$/, '')
    .replace(/es$/, '')
    .trim();

  if (ingRoot.length >= 4 && (dealRoot.includes(ingRoot) || ingRoot.includes(dealRoot))) return true;

  // Token overlap: if ≥1 meaningful token matches
  const ingTokens = ing.split(/[\s-]+/).filter((t) => t.length >= 4);
  const dealTokens = deal.split(/[\s-]+/).filter((t) => t.length >= 4);
  return ingTokens.some((t) => dealTokens.some((d) => d.includes(t) || t.includes(d)));
}

// For each ingredient, find the best (cheapest) matching deal
function findBestDeal(ingredient: string, deals: DealItem[]): DealItem | null {
  const candidates = deals.filter((d) => ingredientMatchesDeal(ingredient, d.name));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => Number(a.price) - Number(b.price))[0];
}

// Dietary/allergen exclusion tags on recipes
function recipeMatchesPrefs(
  tags: string[],
  dietSet: Set<string>,
  allergenSet: Set<string>
): boolean {
  const t = tags.map((x) => x.toLowerCase());

  // Allergen exclusions
  if (allergenSet.has('gluten') && t.some((x) => x.includes('gluten'))) return false;
  if (allergenSet.has('nuts') && t.some((x) => x.includes('noix') || x.includes('nuts'))) return false;
  if (allergenSet.has('lactose') && t.some((x) => x.includes('lait') || x.includes('dairy'))) return false;

  // If user is vegan, only vegan recipes
  if (dietSet.has('vegan') && !t.includes('végétalien') && !t.includes('vegan')) return false;
  // If vegetarian (non-vegan), exclude meat recipes explicitly tagged
  if (dietSet.has('vegetarian') && !dietSet.has('vegan') &&
    t.some((x) => x.includes('viande') || x.includes('poulet') || x.includes('bœuf') || x.includes('porc'))) {
    return false;
  }

  return true;
}

export interface MatchResult {
  selectedRecipes: RecipeMatch[];
  extraDeals: DealItem[];   // deals not covered by any recipe ingredient — show as extras
}

export async function matchRecipesToDeals(
  deals: DealItem[],
  options: {
    recipesPerWeek: number;
    householdSize: number;
    dietSet: Set<string>;
    allergenSet: Set<string>;
    dislikeSet: Set<string>;
    shoppingMode: 'single_store' | 'multi_store';
  }
): Promise<MatchResult> {
  const { recipesPerWeek, dietSet, allergenSet, dislikeSet } = options;

  // Load all recipes with their ingredients
  const allRecipes = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      servings: recipes.servings,
      prepTimeMin: recipes.prepTimeMin,
      cookTimeMin: recipes.cookTimeMin,
      sourceUrl: recipes.sourceUrl,
      tags: recipes.tags,
    })
    .from(recipes);

  if (allRecipes.length === 0) {
    // No recipes in DB yet — return empty, caller falls back to deal-only list
    return { selectedRecipes: [], extraDeals: deals };
  }

  // Score each recipe
  const scored: RecipeMatch[] = [];

  for (const recipe of allRecipes) {
    // Filter by dietary prefs
    if (!recipeMatchesPrefs(recipe.tags, dietSet, allergenSet)) continue;

    const ings = await db
      .select({
        ingredientNormalized: recipeIngredients.ingredientNormalized,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        optional: recipeIngredients.optional,
      })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipe.id));

    // Skip recipes with dislikes
    const hasDislike = ings.some((i) =>
      [...dislikeSet].some((d) => i.ingredientNormalized.toLowerCase().includes(d))
    );
    if (hasDislike) continue;

    const required = ings.filter((i) => !i.optional);
    const matched = required.filter((i) => findBestDeal(i.ingredientNormalized, deals) !== null);

    const matchPct = required.length > 0 ? matched.length / required.length : 0;

    // Only consider recipes with at least 1 ingredient on sale
    if (matched.length === 0) continue;

    const ingredientsWithDeals: IngredientWithDeal[] = ings.map((i) => ({
      ...i,
      deal: findBestDeal(i.ingredientNormalized, deals),
    }));

    scored.push({
      recipeId: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      prepTimeMin: recipe.prepTimeMin,
      cookTimeMin: recipe.cookTimeMin,
      sourceUrl: recipe.sourceUrl,
      matchCount: matched.length,
      totalIngredients: required.length,
      matchPct,
      ingredients: ingredientsWithDeals,
    });
  }

  // Sort: most deal coverage first, then most matched items as tiebreaker
  scored.sort((a, b) =>
    b.matchPct - a.matchPct || b.matchCount - a.matchCount
  );

  const selectedRecipes = scored.slice(0, recipesPerWeek);

  // Which deals were actually used by selected recipes?
  const usedDealIds = new Set(
    selectedRecipes.flatMap((r) =>
      r.ingredients.filter((i) => i.deal).map((i) => i.deal!.dealId)
    )
  );

  // Extra deals = good deals not covered by any recipe (useful staples)
  const extraDeals = deals
    .filter((d) => !usedDealIds.has(d.dealId))
    .sort((a, b) => {
      const regA = Number(a.regularPrice ?? a.price);
      const regB = Number(b.regularPrice ?? b.price);
      const pctA = regA > 0 ? (regA - Number(a.price)) / regA : 0;
      const pctB = regB > 0 ? (regB - Number(b.price)) / regB : 0;
      return pctB - pctA;
    })
    .slice(0, 10); // top 10 extra deals as bonus items

  return { selectedRecipes, extraDeals };
}
