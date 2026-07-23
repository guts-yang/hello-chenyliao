import type { ReactNode } from 'react';

export function TextField({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-primary/70">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-primary/15 bg-black/40 px-3 py-2 text-sm text-[#E1E0CC] outline-none focus:border-primary/40"
      />
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
