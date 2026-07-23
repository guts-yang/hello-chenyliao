import { useState, type ReactNode } from 'react';
import { adminFetch } from '@/lib/adminApi';
import type { Localized } from '@/types';

export function LocalizedField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: Localized;
  onChange: (next: Localized) => void;
  rows?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function translate() {
    if (!value.zh.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminFetch<{ items: Record<string, string> }>(
        '/api/admin/ai/translate',
        { method: 'POST', body: JSON.stringify({ items: { text: value.zh } }) },
        true,
      );
      onChange({ ...value, en: result.items.text || value.en });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-primary/70">{label}</label>
        <button
          type="button"
          disabled={busy || !value.zh.trim()}
          onClick={() => void translate()}
          className="rounded-full border border-primary/20 px-2.5 py-1 text-[11px] text-primary disabled:opacity-40"
        >
          {busy ? '翻译中…' : '中→英'}
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <textarea
          value={value.zh}
          rows={rows}
          placeholder="中文"
          onChange={(event) => onChange({ ...value, zh: event.target.value })}
          className="w-full rounded-xl border border-primary/15 bg-black/40 px-3 py-2 text-sm text-[#E1E0CC] outline-none focus:border-primary/40"
        />
        <textarea
          value={value.en}
          rows={rows}
          placeholder="English"
          onChange={(event) => onChange({ ...value, en: event.target.value })}
          className="w-full rounded-xl border border-primary/15 bg-black/40 px-3 py-2 text-sm text-[#E1E0CC] outline-none focus:border-primary/40"
        />
      </div>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs text-primary/70">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-primary/15 bg-black/40 px-3 py-2 text-sm text-[#E1E0CC] outline-none focus:border-primary/40';

export function emptyLocalized(): Localized {
  return { zh: '', en: '' };
}
