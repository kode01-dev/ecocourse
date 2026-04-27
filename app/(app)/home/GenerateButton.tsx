'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shopping-list/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la génération.');
        return;
      }
      router.push(`/list/${data.listId}`);
    } catch {
      setError('Erreur réseau. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-60 text-white font-semibold py-5 text-lg shadow-md transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Génération en cours…
          </span>
        ) : '🛒 Faire ma liste d\'épicerie'}
      </button>
      {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}
      <p className="text-xs text-neutral-400 text-center mt-2">
        Basée sur les rabais de la semaine · données simulées
      </p>
    </div>
  );
}
