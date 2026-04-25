import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/home');

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4" aria-hidden>
          🛒
        </div>
        <h1 className="text-3xl font-bold tracking-tight">EcoCourse</h1>
        <p className="mt-3 text-neutral-600 leading-relaxed">
          Trouve les meilleurs rabais d&apos;épicerie chaque semaine. Mange sainement, sans te ruiner.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href="/signup"
            className="block w-full rounded-lg bg-emerald-600 text-white font-medium py-3 hover:bg-emerald-700"
          >
            Commencer
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-lg border border-neutral-300 font-medium py-3 hover:bg-neutral-50"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
