'use client';

import { useActionState, useState } from 'react';
import { saveProfileAction, type ProfileActionState } from '@/app/actions/profile';

const DIETARY_PREFS = [
  { value: 'vegetarian', label: 'Végétarien' },
  { value: 'vegan', label: 'Végétalien' },
  { value: 'pescatarian', label: 'Pescétarien' },
  { value: 'meat_lover', label: 'Carnivore' },
  { value: 'flexitarian', label: 'Flexitarien' },
  { value: 'keto', label: 'Kéto' },
  { value: 'paleo', label: 'Paléo' },
] as const;

const ALLERGENS = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'lactose', label: 'Lactose' },
  { value: 'nuts', label: 'Noix' },
  { value: 'peanuts', label: 'Arachides' },
  { value: 'shellfish', label: 'Fruits de mer' },
  { value: 'eggs', label: 'Œufs' },
  { value: 'soy', label: 'Soya' },
  { value: 'fish', label: 'Poisson' },
  { value: 'sesame', label: 'Sésame' },
  { value: 'sulfites', label: 'Sulfites' },
] as const;

type AllergenEntry = { allergen: string; severity: 'intolerance' | 'allergy' };

const TOTAL_STEPS = 4;

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    saveProfileAction,
    undefined
  );

  const [step, setStep] = useState(1);
  const [postalCode, setPostalCode] = useState('');
  const [householdSize, setHouseholdSize] = useState('2');
  const [weeklyBudget, setWeeklyBudget] = useState('');
  const [shoppingMode, setShoppingMode] = useState<'single_store' | 'multi_store'>('multi_store');
  const [recipesPerWeek, setRecipesPerWeek] = useState('5');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [allergyList, setAllergyList] = useState<AllergenEntry[]>([]);
  const [dislikesText, setDislikesText] = useState('');

  function toggleDiet(val: string) {
    setDietaryPrefs((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function toggleAllergen(val: string) {
    setAllergyList((prev) => {
      if (prev.find((a) => a.allergen === val)) return prev.filter((a) => a.allergen !== val);
      return [...prev, { allergen: val, severity: 'allergy' }];
    });
  }

  function setSeverity(allergen: string, severity: 'intolerance' | 'allergy') {
    setAllergyList((prev) => prev.map((a) => (a.allergen === allergen ? { ...a, severity } : a)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step < TOTAL_STEPS) {
      e.preventDefault();
      setStep((s) => s + 1);
      return;
    }
    // let the form submit naturally to formAction
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {/* hidden fields always present */}
      <input type="hidden" name="postalCode" value={postalCode} />
      <input type="hidden" name="householdSize" value={householdSize} />
      <input type="hidden" name="weeklyBudget" value={weeklyBudget} />
      <input type="hidden" name="shoppingMode" value={shoppingMode} />
      <input type="hidden" name="recipesPerWeek" value={recipesPerWeek} />
      {dietaryPrefs.map((p) => (
        <input key={p} type="hidden" name="dietaryPrefs" value={p} />
      ))}
      <input type="hidden" name="allergiesJson" value={JSON.stringify(allergyList)} />
      <input type="hidden" name="dislikes" value={dislikesText} />

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-emerald-600' : 'bg-neutral-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Informations de base</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Code postal <span className="text-neutral-400">(optionnel)</span>
            </label>
            <input
              type="text"
              placeholder="G1A 1A1"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nombre de personnes dans le ménage
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setHouseholdSize((s) => String(Math.max(1, Number(s) - 1)))}
                className="w-10 h-10 rounded-full border border-neutral-300 text-lg font-medium"
              >
                −
              </button>
              <span className="text-xl font-bold w-8 text-center">{householdSize}</span>
              <button
                type="button"
                onClick={() => setHouseholdSize((s) => String(Math.min(20, Number(s) + 1)))}
                className="w-10 h-10 rounded-full border border-neutral-300 text-lg font-medium"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Budget hebdomadaire cible <span className="text-neutral-400">(optionnel)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
              <input
                type="number"
                min="0"
                step="5"
                placeholder="150"
                value={weeklyBudget}
                onChange={(e) => setWeeklyBudget(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Recettes par semaine
            </label>
            <select
              value={recipesPerWeek}
              onChange={(e) => setRecipesPerWeek(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} recettes</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Dietary prefs */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Préférences alimentaires</h2>
          <p className="text-sm text-neutral-500">Sélectionne tout ce qui s&apos;applique.</p>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_PREFS.map(({ value, label }) => {
              const selected = dietaryPrefs.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDiet(value)}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium text-left transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-neutral-200 text-neutral-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Allergies */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Allergies & intolérances</h2>
          <p className="text-sm text-neutral-500">Sélectionne, puis précise le niveau.</p>
          <div className="space-y-2">
            {ALLERGENS.map(({ value, label }) => {
              const entry = allergyList.find((a) => a.allergen === value);
              const selected = !!entry;
              return (
                <div key={value} className="border border-neutral-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleAllergen(value)}
                    className={`w-full px-4 py-3 text-sm font-medium text-left flex items-center justify-between transition-colors ${
                      selected ? 'bg-red-50 text-red-800' : 'text-neutral-700'
                    }`}
                  >
                    {label}
                    <span className="text-lg">{selected ? '✓' : '+'}</span>
                  </button>
                  {selected && (
                    <div className="flex border-t border-neutral-200">
                      <button
                        type="button"
                        onClick={() => setSeverity(value, 'intolerance')}
                        className={`flex-1 py-2 text-xs font-medium ${entry.severity === 'intolerance' ? 'bg-amber-100 text-amber-800' : 'text-neutral-500'}`}
                      >
                        Intolérance
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeverity(value, 'allergy')}
                        className={`flex-1 py-2 text-xs font-medium border-l border-neutral-200 ${entry.severity === 'allergy' ? 'bg-red-100 text-red-800' : 'text-neutral-500'}`}
                      >
                        Allergie
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Dislikes + shopping mode */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Derniers détails</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Aliments que tu n&apos;aimes pas <span className="text-neutral-400">(optionnel)</span>
            </label>
            <textarea
              value={dislikesText}
              onChange={(e) => setDislikesText(e.target.value)}
              placeholder="Ex: coriandre, céleri, foie de veau…"
              rows={3}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <p className="text-xs text-neutral-400 mt-1">Sépare par des virgules.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Mode d&apos;achat préféré
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'single_store', label: '1 épicerie', desc: 'Simple, rapide' },
                { value: 'multi_store', label: 'Multi-épiceries', desc: 'Maximum d\'économies' },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setShoppingMode(value)}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    shoppingMode === value
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-3 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-700"
          >
            Retour
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {step < TOTAL_STEPS ? 'Continuer →' : pending ? 'Enregistrement…' : 'Terminer'}
        </button>
      </div>
    </form>
  );
}
