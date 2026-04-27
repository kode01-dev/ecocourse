import 'server-only';
import { getAnthropicClient } from '@/lib/claude/client';

export interface NormalizedIngredient {
  normalized: string;
  category: string;
  unit: string | null;
}

// Normalize up to 50 ingredient names per call.
// Uses prompt caching on the system prompt to reduce cost on repeated batches.
function fallbackMap(names: string[]): Map<string, NormalizedIngredient> {
  const map = new Map<string, NormalizedIngredient>();
  for (const n of names) {
    map.set(n, { normalized: n.toLowerCase().trim(), category: 'autre', unit: null });
  }
  return map;
}

export async function normalizeIngredients(
  names: string[]
): Promise<Map<string, NormalizedIngredient>> {
  if (names.length === 0) return new Map();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[normalize] ANTHROPIC_API_KEY not set — skipping normalization, using raw names');
    return fallbackMap(names);
  }

  const client = getAnthropicClient();

  const systemPrompt = `Tu es un assistant spécialisé dans la normalisation de noms de produits d'épicerie québécois.

Pour chaque produit fourni, retourne un objet JSON avec :
- normalized : nom canonique en minuscules, sans marque, sans quantité (ex: "pomme gala", "poulet entier", "bœuf haché mi-maigre")
- category : une des catégories suivantes : fruits, légumes, viandes, poissons, fruits de mer, produits laitiers, fromages, boulangerie, épicerie, boissons, condiments, surgelés, protéines végé, charcuterie, autre
- unit : unité de mesure principale si présente (kg, g, L, ml, unité, dz, paquet) sinon null

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication.
Format : [{"input": "...", "normalized": "...", "category": "...", "unit": "..."|null}, ...]`;

  const userContent = `Normalise ces produits:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

  let parsed: Array<{ input: string; normalized: string; category: string; unit: string | null }> = [];
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    console.error('[normalize] Failed to parse Claude response:', e, text.slice(0, 200));
    // Fallback: return raw names lowercased
    const fallback = new Map<string, NormalizedIngredient>();
    for (const n of names) {
      fallback.set(n, { normalized: n.toLowerCase(), category: 'autre', unit: null });
    }
    return fallback;
  }

  const result = new Map<string, NormalizedIngredient>();
  for (const item of parsed) {
    if (item.input && item.normalized) {
      result.set(item.input, {
        normalized: item.normalized,
        category: item.category ?? 'autre',
        unit: item.unit ?? null,
      });
    }
  }

  // Fill any missing entries with fallback
  for (const n of names) {
    if (!result.has(n)) {
      result.set(n, { normalized: n.toLowerCase(), category: 'autre', unit: null });
    }
  }

  return result;
}
