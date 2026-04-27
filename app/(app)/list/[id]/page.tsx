import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getShoppingList } from '@/lib/db/queries/shopping';
import { db } from '@/lib/db/client';
import { recipes, shoppingListItems } from '@/lib/db/schema';
import { inArray, eq } from 'drizzle-orm';
import CheckItem from './CheckItem';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ListPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const result = await getShoppingList(id, session.user.id);
  if (!result) notFound();

  const { list, items } = result;

  // Collect all recipe IDs referenced by items
  const allRecipeIds = [...new Set(items.flatMap((i) => i.recipeIds ?? []))];

  // Fetch recipe details
  const recipeDetails = allRecipeIds.length > 0
    ? await db.select({ id: recipes.id, title: recipes.title, servings: recipes.servings, sourceUrl: recipes.sourceUrl, prepTimeMin: recipes.prepTimeMin, cookTimeMin: recipes.cookTimeMin })
        .from(recipes)
        .where(inArray(recipes.id, allRecipeIds))
    : [];

  const recipeMap = new Map(recipeDetails.map((r) => [r.id, r]));

  // Group items by recipe
  const recipeGroups = new Map<string, typeof items>(); // recipeId → items
  const noRecipeItems: typeof items = [];

  for (const item of items) {
    const ids = item.recipeIds ?? [];
    if (ids.length === 0) {
      noRecipeItems.push(item);
    } else {
      // Primary recipe = first ID
      const primaryId = ids[0];
      if (!recipeGroups.has(primaryId)) recipeGroups.set(primaryId, []);
      recipeGroups.get(primaryId)!.push(item);
    }
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const hasRecipes = recipeGroups.size > 0;

  return (
    <main className="min-h-dvh bg-neutral-50 pb-24">
      {/* Sticky header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link href="/home" className="text-neutral-500 text-sm">← Accueil</Link>
            <span className="text-xs text-neutral-400">{checkedCount}/{items.length} items</span>
          </div>
          <h1 className="font-bold text-lg mb-2">Ma liste d&apos;épicerie</h1>
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-neutral-400 mt-1.5">
            <span>{list.mode === 'single_store' ? '1 épicerie' : 'Multi-épiceries'}{hasRecipes ? ` · ${recipeGroups.size} recette${recipeGroups.size > 1 ? 's' : ''}` : ''}</span>
            <span className="text-neutral-700 font-medium">
              {Number(list.totalEstimatedCost ?? 0).toFixed(2)} $
              {list.totalSavings && Number(list.totalSavings) > 0 && (
                <span className="text-emerald-600"> (-{Number(list.totalSavings).toFixed(2)} $)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-6 space-y-6">
        {/* Recipe sections */}
        {[...recipeGroups.entries()].map(([recipeId, recipeItems]) => {
          const recipe = recipeMap.get(recipeId);
          const onSaleCount = recipeItems.filter((i) => i.dealId).length;
          return (
            <section key={recipeId}>
              {/* Recipe card header */}
              <div className="bg-emerald-600 text-white rounded-t-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium opacity-80 mb-0.5">Recette</p>
                    <h2 className="font-semibold text-sm leading-snug">{recipe?.title ?? 'Recette'}</h2>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs opacity-80">{onSaleCount}/{recipeItems.length} en rabais</p>
                    {recipe?.prepTimeMin && (
                      <p className="text-xs opacity-70">{recipe.prepTimeMin} min</p>
                    )}
                  </div>
                </div>
                {recipe?.sourceUrl && (
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline opacity-70 mt-1 block"
                  >
                    Voir la recette →
                  </a>
                )}
              </div>
              <div className="bg-white rounded-b-2xl shadow-sm border border-emerald-100 border-t-0 px-4">
                <ul>
                  {recipeItems.map((item) => (
                    <CheckItem
                      key={item.id}
                      id={item.id}
                      label={item.ingredientLabel}
                      quantity={item.quantity}
                      unit={item.unit}
                      price={item.price ?? null}
                      regularPrice={item.regularPrice ?? null}
                      checked={item.checked}
                      storeName={item.storeName ?? null}
                      onSale={!!item.dealId}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        {/* Extra deals / no-recipe items */}
        {noRecipeItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              {hasRecipes ? 'Extras en rabais' : 'Rabais de la semaine'}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-4">
              <ul>
                {noRecipeItems.map((item) => (
                  <CheckItem
                    key={item.id}
                    id={item.id}
                    label={item.ingredientLabel}
                    quantity={item.quantity}
                    unit={item.unit}
                    price={item.price ?? null}
                    regularPrice={item.regularPrice ?? null}
                    checked={item.checked}
                    storeName={item.storeName ?? null}
                    onSale={!!item.dealId}
                  />
                ))}
              </ul>
            </div>
          </section>
        )}

        {items.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-sm">Aucun item dans cette liste.</p>
          </div>
        )}

        {!hasRecipes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">Aucune recette disponible</p>
            <p className="text-xs">Importe les recettes depuis le panneau admin pour que la liste soit basée sur des recettes.</p>
          </div>
        )}

        <Link
          href="/home"
          className="block w-full text-center py-3 border border-emerald-600 text-emerald-600 rounded-xl text-sm font-semibold"
        >
          Régénérer une nouvelle liste
        </Link>
      </div>
    </main>
  );
}
