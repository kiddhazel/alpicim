import { MODULES } from '../../core/modules';
import { groupByCategory } from '../../core/modules/registry';
import { useModules } from '../../core/modules/useModules';
import { t } from '../../i18n';
import { Badge, Button, Card, Toggle } from '../../shared/ui/primitives';

/**
 * Ayarlar → Modüller: kategoriye göre kart ızgarası (simge, ad, açıklama, aç/kapat, "Ayarlar" bağlantısı).
 * `sectionOf(moduleId)`: modülün Ayarlar bölümü varsa kimliği (bağlantıyı gösterir).
 */
export function ModulesSettings({ sectionOf, onOpenSection }: { sectionOf: (moduleId: string) => string | null; onOpenSection: (id: string) => void }) {
  const { isEnabled, setEnabled } = useModules();
  return (
    <>
      {groupByCategory(MODULES).map(({ category, modules }) => (
        <section key={category} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-semibold text-fg-2">{t(`modules.categories.${category}`)}</h3>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {modules.map((m) => {
              const Icon = m.icon;
              const on = isEnabled(m.id);
              const section = on ? sectionOf(m.id) : null;
              const name = t(m.titleKey);
              return (
                <Card key={m.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-control text-fg-2">
                      <Icon size={18} strokeWidth={1.75} className={on ? 'text-accent' : undefined} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-fg">{name}</p>
                      <p className="mt-0.5 text-sm text-fg-2">{t(m.descriptionKey)}</p>
                    </div>
                    {m.required ? (
                      <Badge>{t('modules.required')}</Badge>
                    ) : (
                      <Toggle checked={on} label={t('modules.toggle', { name })} onChange={(v) => setEnabled(m.id, v)} />
                    )}
                  </div>
                  {section && (
                    <div className="-mb-1">
                      <Button variant="ghost" size="sm" onClick={() => onOpenSection(section)}>
                        {t('modules.settings')}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
