import Link from 'next/link';

export default function OnboardingPage() {
  return (
    <main className="min-h-dvh px-6 py-12 bg-neutral-50">
      <div className="max-w-sm mx-auto">
        <h1 className="text-2xl font-bold mb-2">Onboarding</h1>
        <p className="text-neutral-600 text-sm mb-8">
          Étape suivante (Phase 2) : code postal, taille du ménage, préférences alimentaires, allergies, mode d&apos;achat.
        </p>
        <Link
          href="/home"
          className="block w-full rounded-lg bg-emerald-600 text-white font-medium py-3 text-center hover:bg-emerald-700"
        >
          Continuer (skip pour l&apos;instant)
        </Link>
      </div>
    </main>
  );
}
