import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFullProfile } from '@/lib/db/queries/profiles';
import { ensureStores, ensureMockDeals, getActiveDeals, createShoppingList } from '@/lib/db/queries/shopping';
import { ensureStoreMap } from '@/lib/db/queries/deals';

function filterDeals<T extends {
  name: string;
  category: string | null;
  price: string;
  regularPrice: string | null;
}>(
  allDeals: T[],
  allergenSet: Set<string>,
  dislikeSet: Set<string>,
  excludeMeat: boolean,
  excludeFish: boolean
): T[] {
  return allDeals.filter((d) => {
    const name = d.name.toLowerCase();
    const cat = (d.category ?? '').toLowerCase();

    for (const dis of dislikeSet) {
      if (name.includes(dis)) return false;
    }

    if (excludeMeat && cat === 'viandes') return false;
    if (excludeFish && (cat === 'poissons' || cat === 'fruits de mer')) return false;

    if (allergenSet.has('shellfish') && cat === 'fruits de mer') return false;
    if (allergenSet.has('fish') && cat === 'poissons') return false;
    if (allergenSet.has('eggs') && name.includes('œuf')) return false;
    if (allergenSet.has('lactose') && (cat === 'produits laitiers' || cat === 'fromages')) return false;
    if (allergenSet.has('gluten') && (cat === 'boulangerie' || name.includes('pain') || name.includes('pâtes'))) return false;
    if (allergenSet.has('soy') && name.includes('tofu')) return false;

    return true;
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const userId = session.user.id;
  const { profile, prefs, allergies, dislikes } = await getFullProfile(userId);

  const mode = profile?.shoppingMode ?? 'multi_store';

  // Ensure stores exist (both mock + real path need this)
  await ensureStoreMap();

  // Try real deals first; fall back to mock if none exist yet
  let allDeals = await getActiveDeals();

  if (allDeals.length === 0) {
    // No real deals scraped yet — seed mock data so the app works immediately
    const storeList = await ensureStores();
    await ensureMockDeals(storeList);
    allDeals = await getActiveDeals();
  }

  const allergenSet = new Set(allergies.map((a) => a.allergen));
  const dislikeSet = new Set(dislikes.map((d) => d.ingredient.toLowerCase()));
  const dietSet = new Set(prefs.map((p) => p.preferenceType));

  const excludeMeat = dietSet.has('vegetarian') || dietSet.has('vegan') || dietSet.has('pescatarian');
  const excludeFish = dietSet.has('vegetarian') || dietSet.has('vegan');

  const filteredDeals = filterDeals(allDeals, allergenSet, dislikeSet, excludeMeat, excludeFish);

  // Sort by savings desc (biggest discount first)
  const sorted = [...filteredDeals].sort((a, b) => {
    const savA = Number(a.regularPrice ?? a.price) - Number(a.price);
    const savB = Number(b.regularPrice ?? b.price) - Number(b.price);
    return savB - savA;
  });

  const targetItems = (profile?.recipesPerWeek ?? 5) * 3;
  const selected = sorted.slice(0, Math.min(targetItems, sorted.length));

  let finalItems = selected;

  if (mode === 'single_store') {
    // Pick the store with the most winning deals
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
    totalSavings += Math.max(0, regular - price);

    return {
      productId: d.productId,
      storeId: d.storeId,
      dealId: d.dealId,
      ingredientLabel: d.name,
      quantity: '1',
      unit: d.unit,
    };
  });

  if (listItems.length === 0) {
    return NextResponse.json({ error: 'Aucun produit disponible selon tes préférences.' }, { status: 422 });
  }

  const listId = await createShoppingList(
    userId,
    mode,
    listItems,
    totalCost.toFixed(2),
    totalSavings.toFixed(2)
  );

  return NextResponse.json({ listId });
}
