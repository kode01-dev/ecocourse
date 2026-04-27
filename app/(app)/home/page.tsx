import { auth } from '@/auth';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import GenerateButton from './GenerateButton';
import AdminTools from './AdminTools';

export default async function AppHomePage() {
  const session = await auth();

  return (
    <main className="min-h-dvh px-6 py-12 bg-neutral-50">
      <div className="max-w-sm mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-1">Bonjour 👋</h1>
          <p className="text-neutral-500 text-sm">{session?.user?.email}</p>
        </div>

        <GenerateButton />

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            href="/settings"
            className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-emerald-400 transition-colors"
          >
            <div className="text-2xl mb-1">⚙️</div>
            <div className="text-sm font-medium text-neutral-800">Mes préférences</div>
            <div className="text-xs text-neutral-400 mt-0.5">Allergies, budget, mode</div>
          </Link>
          <Link
            href="/pantry"
            className="block rounded-xl border border-neutral-200 bg-white p-4 opacity-40 cursor-not-allowed"
          >
            <div className="text-2xl mb-1">🥫</div>
            <div className="text-sm font-medium text-neutral-800">Mon garde-manger</div>
            <div className="text-xs text-neutral-400 mt-0.5">Bientôt disponible</div>
          </Link>
        </div>

        <AdminTools />

        <form action={logoutAction} className="mt-8 text-center">
          <button type="submit" className="text-sm text-neutral-400 hover:text-neutral-600 underline">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
