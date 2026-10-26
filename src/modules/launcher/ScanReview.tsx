import { ArrowLeft, Check, Gamepad2, Loader2, Monitor, Plus, ScanSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { Badge, Button, cx, IconButton, Select } from '../../shared/ui/primitives';
import { describeError, StateView } from '../../shared/ui/StateView';
import { AppIcon } from './AppIcon';
import { APP_CATEGORIES, categorize, sortCategories } from './categorize';
import { launcherService, type NewLaunchItem, type ScannedApp } from './launcherService';

interface Row extends ScannedApp {
  category: string;
  selected: boolean;
  alreadyAdded: boolean;
}

interface Props {
  existingPaths: ReadonlySet<string>;
  onCancel: () => void;
  onConfirm: (items: NewLaunchItem[]) => Promise<void>;
}

/** Bilgisayardaki uygulamaları tarar; kullanıcı kategorileri gözden geçirip seçtiklerini ekler. */
export function ScanReview({ existingPaths, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    launcherService
      .scan()
      .then((apps) => {
        if (!alive) return;
        setRows(
          apps.map((a) => {
            const alreadyAdded = existingPaths.has(a.path.toLowerCase());
            return { ...a, category: categorize(a), selected: !alreadyAdded, alreadyAdded };
          }),
        );
      })
      .catch((err: unknown) => alive && setError(err));
    return () => {
      alive = false;
    };
    // Tarama yalnızca açılışta bir kez yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    if (!rows) return [];
    return sortCategories(rows.map((r) => r.category)).map((c) => ({ category: c, rows: rows.filter((r) => r.category === c) }));
  }, [rows]);

  const selectedCount = rows?.filter((r) => r.selected && !r.alreadyAdded).length ?? 0;

  const update = (path: string, patch: Partial<Row>) =>
    setRows((list) => list?.map((r) => (r.path === path ? { ...r, ...patch } : r)) ?? null);

  const setGroup = (category: string, selected: boolean) =>
    setRows((list) => list?.map((r) => (r.category === category && !r.alreadyAdded ? { ...r, selected } : r)) ?? null);

  const confirm = async () => {
    if (!rows) return;
    setSaving(true);
    try {
      await onConfirm(
        rows
          .filter((r) => r.selected && !r.alreadyAdded)
          .map((r) => ({ path: r.path, name: r.name, category: r.category, target: r.target })),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
        <IconButton icon={ArrowLeft} label={t('common.back')} onClick={onCancel} />
        <div className="min-w-0 flex-1">
          <h3 className="text-md font-semibold">{t('launcher.scanTitle')}</h3>
          <p className="truncate text-xs text-fg-3">{t('launcher.scanHint')}</p>
        </div>
        <Button variant="primary" icon={saving ? Loader2 : Plus} disabled={!rows || selectedCount === 0 || saving} onClick={() => void confirm()}>
          {t('launcher.scanAdd', { n: selectedCount })}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error ? (
          <StateView kind="error" title={t('launcher.scanFailed')} description={describeError(error).description} />
        ) : !rows ? (
          <StateView kind="loading" title={t('launcher.scanning')} description={t('launcher.scanningBody')} />
        ) : rows.length === 0 ? (
          <StateView kind="empty" title={t('launcher.scanEmpty')} />
        ) : (
          groups.map(({ category, rows: list }) => {
            const selectable = list.filter((r) => !r.alreadyAdded);
            const allOn = selectable.length > 0 && selectable.every((r) => r.selected);
            return (
              <section key={category} className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-3">
                    {category || t('launcher.uncategorized')} <span className="tabular font-normal">({list.length})</span>
                  </h4>
                  {selectable.length > 0 && (
                    <button type="button" className="text-xs text-accent hover:underline" onClick={() => setGroup(category, !allOn)}>
                      {allOn ? t('launcher.selectNone') : t('launcher.selectAll')}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-stroke overflow-hidden rounded-xl bg-layer">
                  {list.map((r) => (
                    <li key={r.path} className={cx('flex items-center gap-3 px-4 py-2.5', r.alreadyAdded && 'opacity-55')}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                        checked={r.alreadyAdded || r.selected}
                        disabled={r.alreadyAdded}
                        onChange={(e) => update(r.path, { selected: e.target.checked })}
                        aria-label={r.name}
                      />
                      <AppIcon path={r.path} fallback={r.target.includes('://') ? Gamepad2 : Monitor} size={24} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="selectable truncate text-xs text-fg-3" title={r.target}>
                          {r.target}
                        </p>
                      </div>
                      {r.alreadyAdded ? (
                        <Badge tone="up">
                          <Check size={12} /> {t('launcher.alreadyAdded')}
                        </Badge>
                      ) : (
                        <Select
                          value={r.category}
                          onChange={(e) => update(r.path, { category: e.target.value })}
                          aria-label={t('launcher.category')}
                          className="h-8 w-40 shrink-0 text-sm"
                        >
                          {APP_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
      {rows && rows.length > 0 && (
        <p className="shrink-0 px-4 py-2 text-xs text-fg-3">
          <ScanSearch size={12} className="mr-1 inline" />
          {t('launcher.scanSummary', { n: rows.length })}
        </p>
      )}
    </div>
  );
}
