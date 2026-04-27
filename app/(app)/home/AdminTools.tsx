'use client';

import { useState } from 'react';

export default function AdminTools() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  async function trigger(endpoint: string, label: string) {
    setLoading(label);
    setStatus('');
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setStatus(`Erreur: ${data.error ?? res.status}`);
      else setStatus(JSON.stringify(data, null, 2));
    } catch (e) {
      setStatus(`Erreur réseau: ${e}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <details className="mt-8 border border-dashed border-neutral-300 rounded-xl p-4">
      <summary className="text-xs text-neutral-400 cursor-pointer select-none">
        Outils dev / admin
      </summary>
      <div className="mt-3 space-y-2">
        <button
          disabled={!!loading}
          onClick={() => trigger('/api/deals/refresh', 'deals')}
          className="w-full py-2 border border-neutral-200 rounded-lg text-xs text-neutral-600 disabled:opacity-50"
        >
          {loading === 'deals' ? '⏳ Scrape Flipp en cours…' : '🔄 Rafraîchir les rabais (Flipp)'}
        </button>
        <button
          disabled={!!loading}
          onClick={() => trigger('/api/recipes/scrape', 'recipes')}
          className="w-full py-2 border border-neutral-200 rounded-lg text-xs text-neutral-600 disabled:opacity-50"
        >
          {loading === 'recipes' ? '⏳ Scrape Ricardo en cours…' : '📖 Importer recettes Ricardo'}
        </button>
        {status && (
          <pre className="text-xs bg-neutral-100 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
            {status}
          </pre>
        )}
      </div>
    </details>
  );
}
