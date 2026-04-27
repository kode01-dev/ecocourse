import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFullProfile } from '@/lib/db/queries/profiles';
import { getActiveDeals, createShoppingList } from '@/lib/db/queries/shopping';
import { ensureStoreMap } from '@/lib/db/queries/deals';
import { matchRecipesToDeals, type DealItem } from '@/lib/matching/recipe-matcher';
import type { ListItemInput } from '@/lib/db/queries/shopping';

// Non-food keyword blacklist — last-resort safety net
const NON_FOOD_KEYWORDS = [
  'robinet', 'clôture', 'motoculteur', 'toilette', 'pompe', 'sac à dos',
  'cafetière', 'masse ', 'sécateur', 'lampe', 'baignoire', 'douche',
  'outillage', 'outil', 'jardin', 'pelouse', 'électronique', 'vêtement',
  'chaussure', 'jouet', 'buckmaster', 'falcon', 'quasar', 'lorain',
  'submersible', 'equalizer', 'bagages',
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const userId = session.user.id;
  const { profile, prefs, allergies, dislikes } = await getFullProfile(userId);

  const mode = profile?.shoppingMode ?? 'multi_store';
  const recipesPerWeek = profile?.recipesPerWeek ?? 5;
  const householdSize = profile?.householdSize ?? 2;

  // Ensure stores exist
  await ensureStoreMap();

  // Get active food deals
  const allDeals = await getActiveDeals();

  if (allDeals.length === 0) {
    return NextResponse.json(
      { error: 'Aucun rabais disponible. Lance un rafraîchissement depuis les outils admin.' },
      { status: 422 }
    );
  }

  const allergenSet = new Set(allergies.map((a) => a.allergen));
  const dislikeSet = new Set(dislikes.map((d) => d.ingredient.toLowerCase()));
  const dietSet = new Set(prefs.map((p) => p.preferenceType));

  const excludeMeat = dietSet.has('vegetarian') || dietSet.has('vegan') || dietSet.has('pescatarian');
  const excludeFish = dietSet.has('vegetarian') || dietSet.has('vegan');

  // Filter deals by dietary prefs + allergens + non-food safety net
  const filteredDeals: DealItem[] = allDeals
    .filter((d) => {
      const name = d.name.toLowerCase();
      const cat = (d.category ?? '').toLowerCase();

      // Non-food safety net
      if (NON_FOOD_KEYWORDS.some((kw) => name.includes(kw))) return false;

      // Dietary
      if (excludeMeat && cat === 'viandes') return false;
      if (excludeFish && (cat === 'poissons' || cat === 'fruits de mer')) return false;

      // Allergens
      if (allergenSet.has('shellfish') && cat === 'fruits de mer') return false;
      if (allergenSet.has('fish') && cat === 'poissons') return false;
      if (allergenSet.has('eggs') && name.includes('œuf')) return false;
      if (allergenSet.has('lactose') && (cat === 'produits laitiers' || cat === 'fromages')) return false;
      if (allergenSet.has('gluten') && (cat === 'boulangerie' || name.includes('pain') || name.includes('pâtes'))) return false;
      if (allergenSet.has('soy') && name.includes('tofu')) return false;

      // Dislikes
      for (const dis of dislikeSet) {
        if (name.includes(dis)) return false;
      }

      return true;
    })
    .map((d) => ({ ...d, dealId: d.dealId, name: d.name, category: d.category }));

  // --- Recipe-first flow ---
  const { selectedRecipes, extraDeals } = await matchRecipesToDeals(filteredDeals, {
    recipesPerWeek,
    householdSize,
    dietSet,
    allergenSet,
    dislikeSet,
    shoppingMode: mode,
  });

  const listItems: ListItemInput[] = [];
  let totalCost = 0;
  let totalSavings = 0;

  // Seen ingredient labels to avoid duplicates across recipes
  const seen = new Map<string, string>(); // ingredientNormalized → listItem index (for dedup)

  if (selectedRecipes.length > 0) {
    // Build list from recipe ingredients
    for (const recipe of selectedRecipes) {
      for (const ing of recipe.ingredients) {
        if (ing.optional) continue;

        const key = ing.ingredientNormalized.toLowerCase();
        if (seen.has(key)) {
          // Already in list — add this recipe ID to its recipeIds
          const idx = parseInt(seen.get(key)!);
          listItems[idx].recipeIds.push(recipe.recipeId);
          continue;
        }

        seen.set(key, String(listItems.length));

        if (ing.deal) {
          const price = Number(ing.deal.price);
          const regular = Number(ing.deal.regularPrice ?? ing.deal.price);
          totalCost += price;
          totalSavings += Math.max(0, regular - price);

          listItems.push({
            productId: ing.deal.productId,
            storeId: ing.deal.storeId,
            dealId: ing.deal.dealId,
            ingredientLabel: ing.ingredientNormalized,
            quantity: ing.quantity,
            unit: ing.unit ?? ing.deal.unit,
            recipeIds: [recipe.recipeId],
            recipeLabel: recipe.title,
          });
        } else {
          // Ingredient not on sale — add without deal/store
          listItems.push({
            productId: null,
            storeId: null,
            dealId: null,
            ingredientLabel: ing.ingredientNormalized,
            quantity: ing.quantity,
            unit: ing.unit,
            recipeIds: [recipe.recipeId],
            recipeLabel: recipe.title,
          });
        }
      }
    }

    // Add top extra deals as bonus items (pantry staples on sale)
    for (const d of extraDeals.slice(0, 5)) {
      const key = d.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, String(listItems.length));

      const price = Number(d.price);
      const regular = Number(d.regularPrice ?? d.price);
      totalCost += price;
      totalSavings += Math.max(0, regular - price);

      listItems.push({
        productId: d.productId,
        storeId: d.storeId,
        dealId: d.dealId,
        ingredientLabel: d.name,
        quantity: '1',
        unit: d.unit,
        recipeIds: [],
        recipeLabel: null,
      });
    }
  } else {
    // No recipes in DB yet — fall back to top deals sorted by % discount
    const sorted = [...filteredDeals].sort((a, b) => {
      const regA = Number(a.regularPrice ?? a.price);
      const regB = Number(b.regularPrice ?? b.price);
      const pctA = regA > 0 ? (regA - Number(a.price)) / regA : 0;
      const pctB = regB > 0 ? (regB - Number(b.price)) / regB : 0;
      return pctB - pctA;
    });

    // Single store: restrict to best store
    let finalDeals = sorted;
    if (mode === 'single_store') {
      const storeCount = new Map<string, number>();
      for (const d of sorted) storeCount.set(d.storeId, (storeCount.get(d.storeId) ?? 0) + 1);
      const bestStoreId = [...storeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (bestStoreId) finalDeals = sorted.filter((d) => d.storeId === bestStoreId);
    }

    for (const d of finalDeals.slice(0, recipesPerWeek * 3)) {
      const price = Number(d.price);
      const regular = Number(d.regularPrice ?? d.price);
      totalCost += price;
      totalSavings += Math.max(0, regular - price);

      listItems.push({
        productId: d.productId,
        storeId: d.storeId,
        dealId: d.dealId,
        ingredientLabel: d.name,
        quantity: '1',
        unit: d.unit,
        recipeIds: [],
        recipeLabel: null,
      });
    }
  }

  if (listItems.length === 0) {
    return NextResponse.json(
      { error: 'Aucun produit disponible selon tes préférences. Essaie de rafraîchir les rabais.' },
      { status: 422 }
    );
  }

  // Single-store constraint post-filter
  let finalItems = listItems;
  if (mode === 'single_store' && selectedRecipes.length === 0) {
    // Already handled above in fallback path
  } else if (mode === 'single_store') {
    // Keep only items with a deal, restrict to the store with most deal items
    const dealItems = listItems.filter((i) => i.storeId);
    const storeCount = new Map<string, number>();
    for (const i of dealItems) storeCount.set(i.storeId!, (storeCount.get(i.storeId!) ?? 0) + 1);
    const bestStoreId = [...storeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (bestStoreId) {
      finalItems = listItems.map((i) =>
        i.storeId && i.storeId !== bestStoreId
          ? { ...i, storeId: null, dealId: null, productId: null } // keep ingredient, remove store
          : i
      );
    }
  }

  const listId = await createShoppingList(
    userId,
    mode,
    finalItems,
    totalCost.toFixed(2),
    totalSavings.toFixed(2),
    selectedRecipes.length
  );

  return NextResponse.json({
    listId,
    recipeCount: selectedRecipes.length,
    itemCount: finalItems.length,
  });
}
