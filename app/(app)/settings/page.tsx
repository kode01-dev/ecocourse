import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getFullProfile } from '@/lib/db/queries/profiles';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { profile, prefs, allergies, dislikes } = await getFullProfile(session.user.id);

  const initial = {
    postalCode: profile?.postalCode ?? '',
    householdSize: profile?.householdSize ?? 1,
    weeklyBudget: profile?.weeklyBudget ?? '',
    shoppingMode: (profile?.shoppingMode ?? 'multi_store') as 'single_store' | 'multi_store',
    recipesPerWeek: profile?.recipesPerWeek ?? 5,
    dietaryPrefs: prefs.map((p) => p.preferenceType),
    allergies: allergies.map((a) => ({ allergen: a.allergen, severity: a.severity })),
    dislikes: dislikes.map((d) => d.ingredient).join(', '),
  };

  return (
    <main className="min-h-dvh bg-neutral-50 px-6 py-10 pb-24">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/home" className="text-neutral-500 hover:text-neutral-800 text-sm">← Retour</Link>
          <h1 className="text-xl font-bold">Mes préférences</h1>
        </div>
        <SettingsForm initial={initial} />
      </div>
    </main>
  );
}
