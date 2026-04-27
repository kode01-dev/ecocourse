import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFullProfile } from '@/lib/db/queries/profiles';
import { ensureStores, ensureMockDeals, getActiveDeals, createShoppingList } from '@/lib/db/queries/shopping';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const userId = session.user.id;
  const { profile, prefs, allergies, dislikes } = await getFullProfile(userId);

  const mode = profile?.shoppingMode ?? 'multi_store';

  // Ensure stores + mock deals exist
  const storeList = await ensureStores();
  await ensureMockDeals(storeList);

  const allDeals = await getActiveDeals();

  // Filter: remove items with allergens or dislikes
  const allergenSet = new Set(allergies.map((a) => a.allergen));
  const dislikeSet = new Set(dislikes.map((d) => d.ingredient.toLowerCase()));
  const dietSet = new Set(prefs.map((p) => p.preferenceType));

  // Simple meat exclusion for veg diets
  const excludeMeat = dietSet.has('vegetarian') || dietSet.has('vegan') || dietSet.has('pescatarian');
  const excludeFish = dietSet.has('vegetarian') || dietSet.has('vegan');

  const filteredDeals = allDeals.filter((d) => {
    const name = d.name.toLowerCase();
    // Dislikes
    for (const dis of dislikeSet) {
      if (name.includes(dis)) return false;
    }
    // Meat exclusion
    if (excludeMeat && d.category === 'viandes') return false;
    if (excludeFish && d.category === 'poissons') return false;
    if (excludeFish && d.category === 'fruits de mer') return false;
    // Allergen exclusion (simple keyword match)
    if (allergenSet.has('shellfish') && d.category === 'fruits de mer') return false;
    if (allergenSet.has('fish') && d.category === 'poissons') return false;
    if (allergenSet.has('eggs') && name.includes('œuf')) return false;
    if (allergenSet.has('lactose') && (d.category === 'produits laitiers' || d.category === 'fromages')) return false;
    if (allergenSet.has('gluten') && (d.category === 'boulangerie' || name.includes('pain') || name.includes('pâtes'))) return false;
    if (allergenSet.has('soy') && name.includes('tofu')) return false;
    return true;
  });

  // Sort by savings (best deal first)
  const sorted = filteredDeals.sort((a, b) => {
    const savA = Number(a.regularPrice ?? a.price) - Number(a.price);
    const savB = Number(b.regularPrice ?? b.price) - Number(b.price);
    return savB - savA;
  });

  // Pick top N items (based on recipesPerWeek × ~3 ingredients)
  const targetItems = (profile?.recipesPerWeek ?? 5) * 3;
  const selected = sorted.slice(0, Math.min(targetItems, sorted.length));

  // In multi_store mode: keep each item at its best store (already there since we sorted by savings)
  // In single_store mode: pick the store that appears most in the top deals
  let finalItems = selected;

  if (mode === 'single_store') {
    const storeCount = new Map<string, number>();
    for (const item of selected) {
      storeCount.set(item.storeId, (storeCount.get(item.storeId) ?? 0) + 1);
    }
    const bestStoreId = [...storeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (bestStoreId) {
      finalItems = selected.filter((d) => d.storeId === bestStoreId);
    }
  }

  let totalCost = 0;
  let totalSavings = 0;

  const listItems = finalItems.map((d) => {
    const price = Number(d.price);
    const regular = Number(d.regularPrice ?? d.price);
    totalCost += price;
    totalSavings += regular - price;

    return {
      productId: d.productId,
      storeId: d.storeId,
      dealId: d.dealId,
      ingredientLabel: d.name,
      quantity: '1',
      unit: d.unit,
    };
  });

  const listId = await createShoppingList(
    userId,
    mode,
    listItems,
    totalCost.toFixed(2),
    totalSavings.toFixed(2)
  );

  return NextResponse.json({ listId });
}
