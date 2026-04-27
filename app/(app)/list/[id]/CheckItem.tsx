'use client';

import { useTransition } from 'react';
import { toggleItemAction } from './actions';

interface Props {
  id: string;
  label: string;
  quantity: string | null;
  unit: string | null;
  price: string | null;
  regularPrice: string | null;
  checked: boolean;
  storeName: string | null;
  onSale: boolean;
}

export default function CheckItem({ id, label, quantity, unit, price, regularPrice, checked, storeName, onSale }: Props) {
  const [isPending, startTransition] = useTransition();

  const savings = price && regularPrice
    ? (Number(regularPrice) - Number(price)).toFixed(2)
    : null;

  return (
    <li
      className={`flex items-start gap-3 py-3 border-b border-neutral-100 last:border-0 ${isPending ? 'opacity-50' : ''}`}
    >
      <button
        onClick={() => startTransition(() => toggleItemAction(id))}
        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-300'
        }`}
      >
        {checked && <span className="text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium capitalize ${checked ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>
          {label}
          {quantity && unit && <span className="text-neutral-400 font-normal"> · {quantity} {unit}</span>}
          {onSale && !checked && <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">rabais</span>}
        </p>
        {storeName && <p className="text-xs text-neutral-400 mt-0.5">{storeName}</p>}
        {!onSale && !checked && <p className="text-xs text-neutral-400 mt-0.5">Prix régulier</p>}
      </div>
      <div className="text-right flex-shrink-0">
        {price && <p className="text-sm font-semibold text-neutral-800">{Number(price).toFixed(2)} $</p>}
        {savings && Number(savings) > 0 && (
          <p className="text-xs text-emerald-600">-{savings} $</p>
        )}
      </div>
    </li>
  );
}
