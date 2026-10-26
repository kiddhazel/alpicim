import { createContext, useContext, type ReactNode } from 'react';
import { Card } from '../../shared/ui/primitives';

/** Seçili ayar bölümünün başlığı: aynı adlı grup başlığı tekrar yazılmasın diye. */
export const SectionTitleContext = createContext<string | null>(null);

/** Ayar grubu: isteğe bağlı küçük başlık + kart içinde satırlar (Windows 11 Ayarlar düzeni). */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  const sectionTitle = useContext(SectionTitleContext);
  const showTitle = title.trim().toLocaleLowerCase('tr-TR') !== sectionTitle?.trim().toLocaleLowerCase('tr-TR');
  return (
    <section className="mb-6">
      {showTitle && <h3 className="mb-2 px-1 text-sm font-semibold text-fg-2">{title}</h3>}
      <Card className="flex flex-col divide-y divide-stroke px-4">{children}</Card>
    </section>
  );
}

/** Etiket + ipucu solda, denetim sağda. */
export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 max-w-xl">
        <p className="text-base text-fg">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-fg-2">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
