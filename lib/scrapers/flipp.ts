import 'server-only';

const FLIPP_BASE = 'https://backflipp.wishabi.com/flipp';
const RATE_LIMIT_MS = 1000;

const TARGET_MERCHANTS = new Set(['IGA', 'Metro', 'Maxi', 'Super C']);

const MERCHANT_SLUG: Record<string, 'iga' | 'metro' | 'maxi' | 'superc'> = {
  IGA: 'iga',
  Metro: 'metro',
  Maxi: 'maxi',
  'Super C': 'superc',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function flippGet(path: string): Promise<unknown> {
  const res = await fetch(`${FLIPP_BASE}${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EcoCourse/1.0; mailto:emile.d@prosomo.com)',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Flipp ${res.status}: ${FLIPP_BASE}${path}`);
  return res.json();
}

function toDateStr(iso: string): string {
  // "2026-04-23T04:00:00+00:00" → "2026-04-23"
  return iso.slice(0, 10);
}

export interface FlippItem {
  name: string;
  nameRaw: string;
  price: number;
  regularPrice: number | null;
  validFrom: string;
  validTo: string;
  merchantSlug: 'iga' | 'metro' | 'maxi' | 'superc';
  merchantName: string;
  category: string | null;
  unit: string | null;
  flippId: number;
}

interface RawFlyer {
  id: number;
  merchant?: string;
  valid_from?: string;
  valid_to?: string;
}

interface RawItem {
  id: number;
  flyer_item_id?: number;
  name?: string;
  current_price?: number | null;
  original_price?: number | null;
  valid_from?: string;
  valid_to?: string;
  merchant_name?: string;
  _L1?: string;
  _L2?: string;
  post_price_text?: string | null;
  pre_price_text?: string | null;
}

export async function scrapeFlipp(postalCode: string): Promise<FlippItem[]> {
  const postal = postalCode.replace(/\s/g, '').toUpperCase();

  // Step 1: get flyer list
  const flyersData = await flippGet(
    `/flyers?locale=fr-CA&postal_code=${encodeURIComponent(postal)}&available_only=1`
  ) as { flyers?: RawFlyer[] };

  const targetFlyers = (flyersData.flyers ?? []).filter(
    (f) => f.merchant && TARGET_MERCHANTS.has(f.merchant)
  );

  console.log(`[Flipp] ${targetFlyers.length} flyers (IGA/Metro/Maxi/Super C) for ${postal}`);

  const results: FlippItem[] = [];
  const seenIds = new Set<number>();

  // Step 2: fetch items for each flyer via ?flyer_id=
  for (const flyer of targetFlyers) {
    await sleep(RATE_LIMIT_MS);

    let data: { items?: RawItem[] };
    try {
      data = await flippGet(
        `/items/search?locale=fr-CA&postal_code=${encodeURIComponent(postal)}&q=&flyer_id=${flyer.id}&limit=200`
      ) as { items?: RawItem[] };
    } catch (e) {
      console.warn(`[Flipp] Failed items for flyer ${flyer.id}:`, e);
      continue;
    }

    const items = data.items ?? [];
    const merchantName = flyer.merchant!;
    const merchantSlug = MERCHANT_SLUG[merchantName];

    for (const item of items) {
      const itemId = item.flyer_item_id ?? item.id;
      if (seenIds.has(itemId)) continue;
      seenIds.add(itemId);

      if (!item.name) continue;
      const price = item.current_price;
      if (price == null || price <= 0) continue;

      // Unit hint from post_price_text e.g. "/kg", "/lb"
      const unit = item.post_price_text?.replace('/', '').trim() ?? null;

      // Category from L2 if available, else L1
      const category = item._L2 ?? item._L1 ?? null;

      results.push({
        name: item.name.trim().toLowerCase(),
        nameRaw: item.name.trim(),
        price,
        regularPrice: item.original_price && item.original_price > price ? item.original_price : null,
        validFrom: item.valid_from ? toDateStr(item.valid_from) : toDateStr(flyer.valid_from ?? new Date().toISOString()),
        validTo: item.valid_to ? toDateStr(item.valid_to) : toDateStr(flyer.valid_to ?? new Date(Date.now() + 7 * 86400000).toISOString()),
        merchantSlug,
        merchantName,
        category,
        unit,
        flippId: itemId,
      });
    }

    console.log(`[Flipp] Flyer ${flyer.id} (${merchantName}): ${items.length} items`);
  }

  console.log(`[Flipp] Total: ${results.length} items from ${targetFlyers.length} flyers`);
  return results;
}
