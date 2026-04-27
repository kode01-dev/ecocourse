import OnboardingForm from './OnboardingForm';

export default function OnboardingPage() {
  return (
    <main className="min-h-dvh px-6 py-10 bg-neutral-50">
      <div className="max-w-sm mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Bienvenue sur ÉcoCourse 🛒</h1>
          <p className="text-neutral-500 text-sm">
            Quelques questions pour personnaliser ta liste d&apos;épicerie.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
