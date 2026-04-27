import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getShoppingList } from '@/lib/db/queries/shopping';
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

  // Group by store
  const byStore = new Map<string, typeof items>();
  for (const item of items) {
    const store = item.storeName ?? 'Épicerie';
    if (!byStore.has(store)) byStore.set(store, []);
    byStore.get(store)!.push(item);
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  return (
    <main className="min-h-dvh bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/home" className="text-neutral-500 text-sm">← Accueil</Link>
            <span className="text-xs text-neutral-400">{checkedCount}/{items.length} items</span>
          </div>
          <h1 className="font-bold text-lg mb-2">Ma liste d&apos;épicerie</h1>
          {/* Progress bar */}
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-400 mt-1.5">
            <span>
              {list.mode === 'single_store' ? '1 épicerie' : 'Multi-épiceries'}
            </span>
            <span className="font-medium text-neutral-700">
              Total estimé : {Number(list.totalEstimatedCost ?? 0).toFixed(2)} $
              {list.totalSavings && Number(list.totalSavings) > 0 && (
                <span className="text-emerald-600"> (économies : {Number(list.totalSavings).toFixed(2)} $)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-6 space-y-6">
        {[...byStore.entries()].map(([storeName, storeItems]) => (
          <section key={storeName}>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              {storeName}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-4">
              <ul>
                {storeItems.map((item) => (
                  <CheckItem
                    key={item.id}
                    id={item.id}
                    label={item.ingredientLabel}
                    quantity={item.quantity}
                    unit={item.unit}
                    price={item.price ?? null}
                    regularPrice={item.regularPrice ?? null}
                    checked={item.checked}
                    storeName={null}
                  />
                ))}
              </ul>
            </div>
          </section>
        ))}

        {items.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-sm">Aucun item dans cette liste.</p>
          </div>
        )}

        <div className="pt-4">
          <Link
            href="/home"
            className="block w-full text-center py-3 border border-emerald-600 text-emerald-600 rounded-xl text-sm font-semibold"
          >
            Régénérer une nouvelle liste
          </Link>
        </div>
      </div>
    </main>
  );
}
