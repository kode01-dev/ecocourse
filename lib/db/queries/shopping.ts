import 'server-only';
import { eq, gte, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  stores,
  products,
  deals,
  shoppingLists,
  shoppingListItems,
} from '@/lib/db/schema';

// Seed the 4 Quebec grocery chains if they don't exist yet
export async function ensureStores() {
  const storeData = [
    { name: 'IGA', slug: 'iga' },
    { name: 'Metro', slug: 'metro' },
    { name: 'Maxi', slug: 'maxi' },
    { name: 'Super C', slug: 'superc' },
  ];

  const existing = await db.select({ slug: stores.slug }).from(stores);
  const existingSlugs = new Set(existing.map((s) => s.slug));

  const toInsert = storeData.filter((s) => !existingSlugs.has(s.slug));
  if (toInsert.length > 0) {
    await db.insert(stores).values(toInsert);
  }

  return db.select().from(stores);
}

// Seed mock weekly deals
export async function ensureMockDeals(storeList: { id: string; slug: string }[]) {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db
    .select({ id: deals.id })
    .from(deals)
    .where(gte(deals.validTo, today))
    .limit(1);

  if (existing.length > 0) return; // already seeded this week

  const mockItems: {
    name: string;
    category: string;
    unit: string;
    storeSlug: string;
    price: string;
    regular: string;
    tags: string[];
  }[] = [
    { name: 'poulet entier', category: 'viandes', unit: 'kg', storeSlug: 'iga', price: '5.99', regular: '8.99', tags: ['meat'] },
    { name: 'saumon atlantique', category: 'poissons', unit: '100g', storeSlug: 'metro', price: '1.99', regular: '3.49', tags: ['fish', 'pescatarian'] },
    { name: 'bœuf haché mi-maigre', category: 'viandes', unit: 'kg', storeSlug: 'maxi', price: '6.99', regular: '9.99', tags: ['meat'] },
    { name: 'pomme gala', category: 'fruits', unit: 'kg', storeSlug: 'iga', price: '1.49', regular: '2.49', tags: ['vegan', 'vegetarian'] },
    { name: 'brocoli', category: 'légumes', unit: 'tête', storeSlug: 'superc', price: '1.99', regular: '2.99', tags: ['vegan', 'vegetarian'] },
    { name: 'patates Russet', category: 'légumes', unit: '4.5 kg', storeSlug: 'maxi', price: '3.99', regular: '5.99', tags: ['vegan', 'vegetarian'] },
    { name: 'pâtes penne', category: 'épicerie', unit: '900g', storeSlug: 'superc', price: '1.79', regular: '2.99', tags: ['vegetarian', 'vegan'] },
    { name: 'tomates en conserve', category: 'épicerie', unit: '796ml', storeSlug: 'iga', price: '0.99', regular: '1.79', tags: ['vegetarian', 'vegan'] },
    { name: 'mozzarella', category: 'fromages', unit: '400g', storeSlug: 'metro', price: '3.99', regular: '5.99', tags: ['vegetarian', 'gluten_free'] },
    { name: 'œufs extra-gros', category: 'produits laitiers', unit: 'dz', storeSlug: 'maxi', price: '4.49', regular: '6.99', tags: ['vegetarian'] },
    { name: 'lait 2%', category: 'produits laitiers', unit: '4L', storeSlug: 'superc', price: '5.49', regular: '6.99', tags: ['vegetarian'] },
    { name: 'pain de blé entier', category: 'boulangerie', unit: '675g', storeSlug: 'iga', price: '2.99', regular: '4.49', tags: ['vegetarian', 'vegan'] },
    { name: 'riz basmati', category: 'épicerie', unit: '2kg', storeSlug: 'metro', price: '4.99', regular: '7.99', tags: ['vegetarian', 'vegan'] },
    { name: 'poitrine de dinde', category: 'viandes', unit: 'kg', storeSlug: 'superc', price: '7.99', regular: '10.99', tags: ['meat'] },
    { name: 'crevettes nordiques', category: 'fruits de mer', unit: '400g', storeSlug: 'iga', price: '5.99', regular: '9.99', tags: ['pescatarian', 'shellfish'] },
    { name: 'tofu ferme', category: 'protéines végé', unit: '350g', storeSlug: 'metro', price: '2.49', regular: '3.99', tags: ['vegan', 'vegetarian'] },
    { name: 'épinards frais', category: 'légumes', unit: '142g', storeSlug: 'maxi', price: '1.99', regular: '3.49', tags: ['vegan', 'vegetarian'] },
    { name: 'avocats', category: 'fruits', unit: '3 unités', storeSlug: 'superc', price: '2.99', regular: '4.99', tags: ['vegan', 'vegetarian'] },
  ];

  const storeMap = new Map(storeList.map((s) => [s.slug, s.id]));

  const validFrom = today;
  const validTo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const item of mockItems) {
    const storeId = storeMap.get(item.storeSlug);
    if (!storeId) continue;

    const [product] = await db
      .insert(products)
      .values({
        nameNormalized: item.name,
        nameRaw: item.name,
        category: item.category,
        unit: item.unit,
      })
      .onConflictDoNothing()
      .returning({ id: products.id });

    const productId = product?.id ?? (
      await db.select({ id: products.id }).from(products).where(eq(products.nameNormalized, item.name)).limit(1)
    )[0]?.id;

    if (!productId) continue;

    await db.insert(deals).values({
      productId,
      storeId,
      price: item.price,
      regularPrice: item.regular,
      validFrom,
      validTo,
      source: item.storeSlug as 'iga' | 'metro' | 'maxi' | 'superc',
    }).onConflictDoNothing();
  }
}

export async function getActiveDeals() {
  const today = new Date().toISOString().split('T')[0];
  return db
    .select({
      dealId: deals.id,
      productId: products.id,
      name: products.nameNormalized,
      category: products.category,
      unit: products.unit,
      price: deals.price,
      regularPrice: deals.regularPrice,
      storeId: stores.id,
      storeName: stores.name,
    })
    .from(deals)
    .innerJoin(products, eq(deals.productId, products.id))
    .innerJoin(stores, eq(deals.storeId, stores.id))
    .where(gte(deals.validTo, today));
}

export async function createShoppingList(
  userId: string,
  mode: 'single_store' | 'multi_store',
  items: {
    productId: string;
    storeId: string;
    dealId: string;
    ingredientLabel: string;
    quantity: string;
    unit: string | null;
  }[],
  totalCost: string,
  totalSavings: string
) {
  const [list] = await db
    .insert(shoppingLists)
    .values({ userId, mode, totalEstimatedCost: totalCost, totalSavings })
    .returning({ id: shoppingLists.id });

  if (items.length > 0) {
    await db.insert(shoppingListItems).values(
      items.map((item) => ({
        listId: list.id,
        productId: item.productId,
        storeId: item.storeId,
        dealId: item.dealId,
        ingredientLabel: item.ingredientLabel,
        quantity: item.quantity,
        unit: item.unit,
      }))
    );
  }

  return list.id;
}

export async function getShoppingList(listId: string, userId: string) {
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.userId, userId)))
    .limit(1);

  if (!list) return null;

  const items = await db
    .select({
      id: shoppingListItems.id,
      ingredientLabel: shoppingListItems.ingredientLabel,
      quantity: shoppingListItems.quantity,
      unit: shoppingListItems.unit,
      checked: shoppingListItems.checked,
      price: deals.price,
      regularPrice: deals.regularPrice,
      storeName: stores.name,
    })
    .from(shoppingListItems)
    .leftJoin(deals, eq(shoppingListItems.dealId, deals.id))
    .leftJoin(stores, eq(shoppingListItems.storeId, stores.id))
    .where(eq(shoppingListItems.listId, listId));

  return { list, items };
}

export async function toggleListItem(itemId: string, userId: string) {
  // Verify ownership via the list
  const [item] = await db
    .select({ checked: shoppingListItems.checked, listId: shoppingListItems.listId })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.id, itemId))
    .limit(1);

  if (!item) return;

  const [ownerCheck] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, item.listId), eq(shoppingLists.userId, userId)))
    .limit(1);

  if (!ownerCheck) return;

  await db
    .update(shoppingListItems)
    .set({ checked: !item.checked })
    .where(eq(shoppingListItems.id, itemId));
}
