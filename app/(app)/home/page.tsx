import { auth } from '@/auth';
import { logoutAction } from '@/app/actions/auth';

export default async function AppHomePage() {
  const session = await auth();

  return (
    <main className="min-h-dvh px-6 py-12 bg-neutral-50">
      <div className="max-w-sm mx-auto">
        <h1 className="text-2xl font-bold mb-2">Bienvenue 👋</h1>
        <p className="text-neutral-600 mb-8 text-sm">{session?.user?.email}</p>

        <button
          disabled
          className="w-full rounded-lg bg-emerald-600 text-white font-medium py-4 text-lg opacity-60 cursor-not-allowed"
        >
          🛒 Faire ma liste d&apos;épicerie
        </button>
        <p className="text-xs text-neutral-500 text-center mt-2">Disponible bientôt — Phase 4.</p>

        <form action={logoutAction} className="mt-12">
          <button type="submit" className="text-sm text-neutral-500 underline">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
