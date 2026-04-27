import 'server-only';

const FLIPP_BASE = 'https://backflipp.wishabi.com/flipp';
const RATE_LIMIT_MS = 1000;

// Merchants we care about and how to normalize their name
const MERCHANT_MAP: Record<string, { name: string; slug: 'iga' | 'metro' | 'maxi' | 'superc' }> = {
  iga: { name: 'IGA', slug: 'iga' },
  metro: { name: 'Metro', slug: 'metro' },
  maxi: { name: 'Maxi', slug: 'maxi' },
  'super-c': { name: 'Super C', slug: 'superc' },
  superc: { name: 'Super C', slug: 'superc' },
  'super c': { name: 'Super C', slug: 'superc' },
};

async function flippFetch(path: string): Promise<unknown> {
  const url = `${FLIPP_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EcoCourse/1.0; mailto:emile.d@prosomo.com)',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Flipp fetch failed: ${res.status} ${url}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  merchant?: { name_identifier?: string; merchant_name?: string };
  name_identifier?: string;
  merchant_name?: string;
  valid_from?: string;
  valid_to?: string;
}

interface RawItem {
  id: number;
  name?: string;
  price?: number | string;
  regular_price?: number | string;
  valid_from?: string;
  valid_to?: string;
  category_name?: string;
  size?: string;
  unit?: string;
  description?: string;
  sale_story?: string;
  flyer_id?: number;
}

function parsePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) || n <= 0 ? null : n;
}

function normalizeMerchant(raw: string | undefined): { name: string; slug: 'iga' | 'metro' | 'maxi' | 'superc' } | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, '-');
  // exact
  if (MERCHANT_MAP[key]) return MERCHANT_MAP[key];
  // partial
  for (const [k, v] of Object.entries(MERCHANT_MAP)) {
    if (key.includes(k) || k.includes(key.replace(/-/g, ' '))) return v;
  }
  return null;
}

export async function scrapeFlipp(postalCode: string): Promise<FlippItem[]> {
  const cleanPostal = postalCode.replace(/\s/g, '').toUpperCase();

  // Step 1: get active flyers for this postal code
  const flyersData = await flippFetch(
    `/flyers?locale=fr-CA&postal_code=${encodeURIComponent(cleanPostal)}&available_only=1`
  ) as { flyers?: RawFlyer[] };

  const flyers: RawFlyer[] = flyersData?.flyers ?? [];

  // Filter to our 4 merchants
  const targetFlyers = flyers.filter((f) => {
    const identifier = f.merchant?.name_identifier ?? f.name_identifier ?? '';
    return normalizeMerchant(identifier) !== null;
  });

  console.log(`[Flipp] Found ${targetFlyers.length} target flyers out of ${flyers.length} total`);

  const results: FlippItem[] = [];

  for (const flyer of targetFlyers) {
    await sleep(RATE_LIMIT_MS);

    const identifier = flyer.merchant?.name_identifier ?? flyer.name_identifier ?? '';
    const merchantInfo = normalizeMerchant(identifier);
    if (!merchantInfo) continue;

    let itemsData: { flyer_items?: RawItem[] } | null = null;
    try {
      itemsData = await flippFetch(`/flyers/${flyer.id}/flyer_items?locale=fr-CA`) as { flyer_items?: RawItem[] };
    } catch (e) {
      console.warn(`[Flipp] Failed to fetch items for flyer ${flyer.id}:`, e);
      continue;
    }

    const items: RawItem[] = itemsData?.flyer_items ?? [];

    for (const item of items) {
      if (!item.name) continue;
      const price = parsePrice(item.price);
      if (!price) continue;

      const regularPrice = parsePrice(item.regular_price);
      const unit = item.size ?? item.unit ?? null;

      results.push({
        name: item.name.trim().toLowerCase(),
        nameRaw: item.name.trim(),
        price,
        regularPrice,
        validFrom: item.valid_from ?? flyer.valid_from ?? new Date().toISOString().split('T')[0],
        validTo: item.valid_to ?? flyer.valid_to ?? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        merchantSlug: merchantInfo.slug,
        merchantName: merchantInfo.name,
        category: item.category_name ?? null,
        unit,
        flippId: item.id,
      });
    }
  }

  console.log(`[Flipp] Scraped ${results.length} items from ${targetFlyers.length} flyers`);
  return results;
}
