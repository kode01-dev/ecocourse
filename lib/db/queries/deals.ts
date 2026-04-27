import 'server-only';
import { eq, and, sql, notInArray, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { stores, products, deals, priceHistory } from '@/lib/db/schema';
import type { FlippItem } from '@/lib/scrapers/flipp';
import { normalizeIngredients } from '@/lib/normalize/ingredients';

// Known food categories (normalized by Claude or raw from Flipp)
const FOOD_CATEGORIES = new Set([
  'fruits', 'légumes', 'viandes', 'poissons', 'fruits de mer',
  'produits laitiers', 'fromages', 'boulangerie', 'épicerie',
  'boissons', 'condiments', 'surgelés', 'protéines végé', 'charcuterie',
  // Raw Flipp English L2 categories that slip through
  'food items', 'beverages', 'fresh food', 'meat', 'seafood', 'dairy',
  'bakery', 'snacks', 'candy', 'frozen', 'produce',
]);

// Delete deals whose product has a non-food category (from bad Flipp scrapes)
export async function purgeNonFoodDeals(): Promise<number> {
  // Find product IDs with non-food categories
  const nonFoodProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(
      sql`lower(${products.category}) NOT IN (${sql.join(
        [...FOOD_CATEGORIES].map((c) => sql`${c}`),
        sql`, `
      )}) AND ${products.category} IS NOT NULL`
    );

  if (nonFoodProducts.length === 0) return 0;

  const ids = nonFoodProducts.map((p) => p.id);
  const result = await db
    .delete(deals)
    .where(inArray(deals.productId, ids));

  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

// Ensure our 4 grocery chains exist; return slug→id map
export async function ensureStoreMap(): Promise<Map<string, string>> {
  const storeData = [
    { name: 'IGA', slug: 'iga' },
    { name: 'Metro', slug: 'metro' },
    { name: 'Maxi', slug: 'maxi' },
    { name: 'Super C', slug: 'superc' },
  ];

  for (const s of storeData) {
    await db.insert(stores).values(s).onConflictDoNothing();
  }

  const rows = await db.select({ id: stores.id, slug: stores.slug }).from(stores);
  return new Map(rows.map((r) => [r.slug, r.id]));
}

// Upsert a batch of Flipp items into products + deals + price_history
export async function upsertDeals(items: FlippItem[]): Promise<{ inserted: number; updated: number }> {
  if (items.length === 0) return { inserted: 0, updated: 0 };

  const storeMap = await ensureStoreMap();

  // Normalize all raw names via Claude (batch of 50)
  const batchSize = 50;
  const normalizedMap = new Map<string, { normalized: string; category: string; unit: string | null }>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const names = batch.map((it) => it.nameRaw);
    const batchResult = await normalizeIngredients(names);
    for (const [k, v] of batchResult) normalizedMap.set(k, v);
  }

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const storeId = storeMap.get(item.merchantSlug);
    if (!storeId) continue;

    const norm = normalizedMap.get(item.nameRaw);
    const nameNormalized = norm?.normalized ?? item.name;
    const category = norm?.category ?? item.category ?? 'autre';
    const unit = norm?.unit ?? item.unit ?? null;

    // Upsert product by normalized name
    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.nameNormalized, nameNormalized))
      .limit(1);

    let productId: string;
    if (existingProduct) {
      productId = existingProduct.id;
    } else {
      const [newProduct] = await db
        .insert(products)
        .values({ nameNormalized, nameRaw: item.nameRaw, category, unit })
        .returning({ id: products.id });
      productId = newProduct.id;
    }

    // Upsert deal — use a composite "natural key" check (product + store + valid_from)
    const [existingDeal] = await db
      .select({ id: deals.id, price: deals.price })
      .from(deals)
      .where(
        and(
          eq(deals.productId, productId),
          eq(deals.storeId, storeId),
          eq(deals.validFrom, item.validFrom)
        )
      )
      .limit(1);

    if (existingDeal) {
      if (existingDeal.price !== String(item.price)) {
        await db
          .update(deals)
          .set({ price: String(item.price), validTo: item.validTo, scrapedAt: new Date() })
          .where(eq(deals.id, existingDeal.id));
        updated++;
      }
    } else {
      await db.insert(deals).values({
        productId,
        storeId,
        price: String(item.price),
        regularPrice: item.regularPrice != null ? String(item.regularPrice) : null,
        validFrom: item.validFrom,
        validTo: item.validTo,
        source: item.merchantSlug,
        rawData: { flippId: item.flippId, nameRaw: item.nameRaw },
      });
      inserted++;
    }

    // Record price history
    await db.insert(priceHistory).values({
      productId,
      storeId,
      price: String(item.price),
    });
  }

  return { inserted, updated };
}

// Used by generate route — returns active deals with store/product info
export { getActiveDeals } from './shopping';
