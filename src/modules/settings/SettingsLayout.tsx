import { createContext, useContext, type ReactNode } from 'react';

/** Seçili ayar bölümünün başlığı: aynı adlı grup başlığı tekrar yazılmasın diye. */
export const SectionTitleContext = createContext<string | null>(null);

export function Group({ title, children }: { title: string; children: ReactNode }) {
  const sectionTitle = useContext(SectionTitleContext);
  const showTitle = title.trim().toLocaleLowerCase('tr-TR') !== sectionTitle?.trim().toLocaleLowerCase('tr-TR');
  return (
    <section className="mb-8">
      {showTitle && <h3 className="mb-2 px-2 text-sm font-semibold tracking-wide text-muted">{title}</h3>}
      <div className="flex flex-col divide-y divide-line rounded-2xl bg-surface-2 px-5">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
      <div className="min-w-0 max-w-xl">
        <p className="text-base font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
