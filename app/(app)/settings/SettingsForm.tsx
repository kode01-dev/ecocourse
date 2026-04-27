'use client';

import { useActionState, useState } from 'react';
import { saveSettingsAction, type ProfileActionState } from '@/app/actions/profile';

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

interface Props {
  initial: {
    postalCode: string;
    householdSize: number;
    weeklyBudget: string;
    shoppingMode: 'single_store' | 'multi_store';
    recipesPerWeek: number;
    dietaryPrefs: string[];
    allergies: AllergenEntry[];
    dislikes: string;
  };
}

export default function SettingsForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    saveSettingsAction,
    undefined
  );

  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [householdSize, setHouseholdSize] = useState(String(initial.householdSize));
  const [weeklyBudget, setWeeklyBudget] = useState(initial.weeklyBudget);
  const [shoppingMode, setShoppingMode] = useState(initial.shoppingMode);
  const [recipesPerWeek, setRecipesPerWeek] = useState(String(initial.recipesPerWeek));
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>(initial.dietaryPrefs);
  const [allergyList, setAllergyList] = useState<AllergenEntry[]>(initial.allergies);
  const [dislikesText, setDislikesText] = useState(initial.dislikes);
  const [saved, setSaved] = useState(false);

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

  return (
    <form
      action={async (fd) => {
        setSaved(false);
        await formAction(fd);
        setSaved(true);
      }}
      className="space-y-8"
    >
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

      {/* Basic */}
      <section className="space-y-4">
        <h2 className="font-semibold text-neutral-800">Informations de base</h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Code postal</label>
          <input
            type="text"
            placeholder="G1A 1A1"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Personnes dans le ménage</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setHouseholdSize((s) => String(Math.max(1, Number(s) - 1)))}
              className="w-10 h-10 rounded-full border border-neutral-300 text-lg font-medium"
            >−</button>
            <span className="text-xl font-bold w-8 text-center">{householdSize}</span>
            <button
              type="button"
              onClick={() => setHouseholdSize((s) => String(Math.min(20, Number(s) + 1)))}
              className="w-10 h-10 rounded-full border border-neutral-300 text-lg font-medium"
            >+</button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Budget hebdomadaire (optionnel)</label>
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
          <label className="block text-sm font-medium text-neutral-700 mb-1">Recettes par semaine</label>
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

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Mode d&apos;achat</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'single_store', label: '1 épicerie', desc: 'Simple, rapide' },
              { value: 'multi_store', label: 'Multi-épiceries', desc: "Maximum d'économies" },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setShoppingMode(value)}
                className={`p-4 rounded-xl border text-left transition-colors ${shoppingMode === value ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200'}`}
              >
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Dietary */}
      <section className="space-y-3">
        <h2 className="font-semibold text-neutral-800">Préférences alimentaires</h2>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_PREFS.map(({ value, label }) => {
            const selected = dietaryPrefs.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDiet(value)}
                className={`py-3 px-4 rounded-xl border text-sm font-medium text-left transition-colors ${
                  selected ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-neutral-200 text-neutral-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Allergies */}
      <section className="space-y-3">
        <h2 className="font-semibold text-neutral-800">Allergies & intolérances</h2>
        <div className="space-y-2">
          {ALLERGENS.map(({ value, label }) => {
            const entry = allergyList.find((a) => a.allergen === value);
            const selected = !!entry;
            return (
              <div key={value} className="border border-neutral-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleAllergen(value)}
                  className={`w-full px-4 py-3 text-sm font-medium text-left flex items-center justify-between transition-colors ${selected ? 'bg-red-50 text-red-800' : 'text-neutral-700'}`}
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
                    >Intolérance</button>
                    <button
                      type="button"
                      onClick={() => setSeverity(value, 'allergy')}
                      className={`flex-1 py-2 text-xs font-medium border-l border-neutral-200 ${entry.severity === 'allergy' ? 'bg-red-100 text-red-800' : 'text-neutral-500'}`}
                    >Allergie</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Dislikes */}
      <section className="space-y-3">
        <h2 className="font-semibold text-neutral-800">Aliments non aimés</h2>
        <textarea
          value={dislikesText}
          onChange={(e) => setDislikesText(e.target.value)}
          placeholder="Ex: coriandre, céleri, foie de veau…"
          rows={3}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <p className="text-xs text-neutral-400">Sépare par des virgules.</p>
      </section>

      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{state.error}</p>
      )}
      {saved && !state?.error && (
        <p className="text-emerald-700 text-sm bg-emerald-50 rounded-lg px-4 py-2">Préférences enregistrées ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {pending ? 'Enregistrement…' : 'Sauvegarder'}
      </button>
    </form>
  );
}
