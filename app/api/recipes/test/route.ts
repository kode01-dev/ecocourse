import { NextResponse } from 'next/server';

export async function GET() {
  const steps: Record<string, unknown> = {};

  // Step 1: fetch categories
  try {
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php', { cache: 'no-store' });
    steps.categoriesStatus = res.status;
    steps.categoriesOk = res.ok;
    const data = await res.json() as { categories?: { strCategory: string }[] };
    steps.categoryCount = data.categories?.length ?? 0;
    steps.categorySample = data.categories?.slice(0, 3).map((c) => c.strCategory);
  } catch (e) {
    steps.categoriesError = String(e);
    return NextResponse.json({ steps });
  }

  // Step 2: fetch meals by letter 'a'
  try {
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?f=a', { cache: 'no-store' });
    steps.searchStatus = res.status;
    const data = await res.json() as { meals?: { idMeal: string; strMeal: string }[] };
    steps.mealCount = data.meals?.length ?? 0;
    steps.mealSample = data.meals?.slice(0, 3).map((m) => m.strMeal);

    // Step 3: fetch detail of first meal
    const firstId = data.meals?.[0]?.idMeal;
    if (firstId) {
      const res2 = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${firstId}`, { cache: 'no-store' });
      const detail = await res2.json() as { meals?: Record<string, string | null>[] };
      const meal = detail.meals?.[0];
      steps.detailOk = !!meal;
      steps.detailName = meal?.strMeal;
      steps.detailIngredient1 = meal?.strIngredient1;
    }
  } catch (e) {
    steps.searchError = String(e);
  }

  return NextResponse.json({ ok: true, steps });
}
