'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-neutral-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Connexion</h1>
        <p className="text-sm text-neutral-600 mb-8">Bon retour sur EcoCourse.</p>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Courriel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 text-white font-medium py-3 hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-neutral-600">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-emerald-700 font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
