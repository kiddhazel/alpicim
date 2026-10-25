import { AlertTriangle, ArrowDown, ArrowUp, Check, FilePlus2, FolderPlus, GripVertical, Pencil, ScanSearch, Search, Star, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { onKeyChanged, writeKey } from '../../shared/lib/store';
import { isTauri } from '../../shared/lib/tauri';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { EMPTY_USAGE, recentIds, recordLaunch, sanitizeUsage, topIds, USAGE_KEY, type UsageMap } from './usage';
import { Badge, Button, cx, IconButton, Select, TextInput } from '../../shared/ui/primitives';
import { describeError, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { AppIcon } from './AppIcon';
import { APP_CATEGORIES, sortCategories } from './categorize';
import { LAUNCHER_ICONS, launcherIcon, usesSystemIcon } from './icons';
import { ScanReview } from './ScanReview';
import { useSettings } from '../settings/settings';
import {
  LAUNCHER_CHANGED_KEY,
  launcherService,
  matchesSearch,
  moveItem,
  type LaunchItem,
  type LaunchItemPatch,
  type NewLaunchItem,
} from './launcherService';

/** Diğer pencerelere "liste değişti" haberini vermek için sürüm anahtarı. */
const VERSION_KEY = LAUNCHER_CHANGED_KEY;

type Filter = 'all' | 'favorites' | `cat:${string}`;


export function LauncherPanel() {
  const toast = useToast();
  const [items, setItems] = useState<LaunchItem[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [settings] = useSettings();
  const [usage, setUsage] = usePersistentState<UsageMap>(USAGE_KEY, EMPTY_USAGE, sanitizeUsage);

  const reload = useCallback(async () => {
    try {
      setItems(await launcherService.list());
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => {
    void reload();
    return onKeyChanged(VERSION_KEY, () => void reload());
  }, [reload]);

  /** Rust komutunu çalıştırır, listeyi günceller ve diğer pencereleri haberdar eder. */
  const mutate = useCallback(
    async (task: () => Promise<LaunchItem[]>, success?: string) => {
      try {
        setItems(await task());
        void writeKey(VERSION_KEY, Date.now());
        if (success) toast.push('success', success);
        return true;
      } catch (err) {
        toast.push('error', describeError(err).description);
        return false;
      }
    },
    [toast],
  );

  const addPaths = async (paths: string[]) => {
    let added = 0;
    for (const p of paths) {
      try {
        setItems(await launcherService.add(p, filter.startsWith('cat:') ? filter.slice(4) : undefined));
        added++;
      } catch (err) {
        toast.push('error', `${p.split(/[\\/]/).pop() ?? p}: ${describeError(err).description}`);
      }
    }
    if (added > 0) {
      void writeKey(VERSION_KEY, Date.now());
      toast.push('success', t('launcher.added', { n: added }));
    }
  };

  const launch = async (item: LaunchItem) => {
    if (editing) return;
    if (!item.exists) {
      toast.push('error', t('launcher.missing', { path: item.path }));
      return;
    }
    try {
      await launcherService.launch(item.id, settings.launcherFocusExisting);
      setUsage((u) => recordLaunch(u, item.id, Date.now()));
    } catch (err) {
      toast.push('error', describeError(err).description);
      void reload();
    }
  };

  const categories = useMemo(() => sortCategories((items ?? []).map((i) => i.category).filter(Boolean)), [items]);

  const addScanned = async (selected: NewLaunchItem[]) => {
    try {
      const res = await launcherService.addMany(selected.map((s) => ({ ...s, icon: 'system' })));
      setItems(res.items);
      void writeKey(VERSION_KEY, Date.now());
      toast.push('success', t('launcher.scanAdded', { n: res.added, skipped: res.skipped }));
      setScanning(false);
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  const visible = useMemo(() => {
    let list = items ?? [];
    if (filter === 'favorites') list = list.filter((i) => i.favorite);
    else if (filter.startsWith('cat:')) list = list.filter((i) => i.category === filter.slice(4));
    return list.filter((i) => matchesSearch(i, search));
  }, [items, filter, search]);

  const canReorder = !search && filter === 'all';

  const showQuick = !search && !editing && filter === 'all';
  const { recentItems, topItems } = useMemo(() => {
    const all = items ?? [];
    const byId = new Map(all.map((i) => [i.id, i]));
    const ids = all.map((i) => i.id);
    const pick = (list: string[]) => list.map((id) => byId.get(id)).filter((i): i is LaunchItem => !!i);
    return { recentItems: pick(recentIds(usage, ids, 8)), topItems: pick(topIds(usage, ids, 5)) };
  }, [items, usage]);

  // "Tümü" görünümünde kategorilere göre bölümler; diğer filtrelerde tek liste.
  const groups = useMemo(() => {
    if (filter !== 'all') return [{ category: null as string | null, list: visible }];
    return sortCategories(visible.map((i) => i.category)).map((c) => ({
      category: c as string | null,
      list: visible.filter((i) => i.category === c),
    }));
  }, [visible, filter]);

  const reorder = (from: number, to: number) => {
    if (!items) return;
    const next = moveItem(items, from, to);
    setItems(next);
    void mutate(() => launcherService.reorder(next.map((i) => i.id)));
  };

  if (!isTauri()) {
    return <StateView kind="desktop" title={t('errors.desktopTitle')} description={t('errors.desktopBody')} />;
  }
  if (scanning) {
    return (
      <ScanReview
        existingPaths={new Set((items ?? []).map((i) => i.path.toLowerCase()))}
        onCancel={() => setScanning(false)}
        onConfirm={addScanned}
      />
    );
  }
  if (loadError) {
    const d = describeError(loadError);
    return <StateView kind={d.kind} title={d.title} description={d.description} action={<Button onClick={() => void reload()}>{t('common.retry')}</Button>} />;
  }

  const countOf = (f: Filter) => {
    const all = items ?? [];
    if (f === 'all') return all.length;
    if (f === 'favorites') return all.filter((i) => i.favorite).length;
    return all.filter((i) => i.category === f.slice(4)).length;
  };

  const renderTile = (item: LaunchItem, opts: { category: string | null; hero?: boolean; interactive: boolean }) => {
    const all = items ?? [];
    const index = all.indexOf(item);
    return (
      <LaunchTile
        item={item}
        hero={opts.hero ?? false}
        editing={opts.interactive && editing}
        showCategory={opts.category === null}
        canMoveUp={opts.interactive && canReorder && index > 0}
        canMoveDown={opts.interactive && canReorder && index < all.length - 1}
        onLaunch={() => void launch(item)}
        onToggleFavorite={() => void mutate(() => launcherService.update({ id: item.id, favorite: !item.favorite }))}
        onEdit={() => setEditId(item.id)}
        onRemove={() => void mutate(() => launcherService.remove(item.id), t('launcher.removed', { name: item.name }))}
        onMove={(delta) => reorder(index, index + delta)}
      />
    );
  };

  const filterEntries: { key: Filter; label: ReactNode; count: number; icon?: boolean }[] = [
    { key: 'all', label: t('launcher.all'), count: countOf('all') },
    { key: 'favorites', label: t('launcher.favorites'), count: countOf('favorites'), icon: true },
    ...categories.map((c) => ({ key: `cat:${c}` as Filter, label: c, count: countOf(`cat:${c}`) })),
  ];

  return (
    <div className="@container flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 px-4 pt-4 pb-3">
        <div className="relative w-full max-w-xl">
          <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('launcher.searchPlaceholder')}
            aria-label={t('launcher.searchPlaceholder')}
            className="h-12 w-full rounded-2xl pl-11 text-base"
          />
        </div>
        <IconButton icon={ScanSearch} label={t('launcher.scan')} onClick={() => setScanning(true)} />
        <IconButton icon={FilePlus2} label={t('launcher.addFile')} onClick={() => void launcherService.pickFiles().then(addPaths)} />
        <IconButton icon={FolderPlus} label={t('launcher.addFolder')} onClick={() => void launcherService.pickFolders().then(addPaths)} />
        <IconButton
          icon={editing ? Check : Pencil}
          active={editing}
          label={editing ? t('launcher.doneEditing') : t('launcher.edit')}
          onClick={() => {
            setEditing((e) => !e);
            setEditId(null);
          }}
        />
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto px-4 pb-2.5 @min-[900px]:hidden">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>{t('launcher.all')}</FilterChip>
        <FilterChip active={filter === 'favorites'} onClick={() => setFilter('favorites')}>
          <Star size={14} /> {t('launcher.favorites')}
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c} active={filter === `cat:${c}`} onClick={() => setFilter(`cat:${c}`)}>
            {c}
          </FilterChip>
        ))}
      </div>

      {editing && (
        <p className="shrink-0 bg-surface-2 px-4 py-2 text-sm text-muted">
          {canReorder ? t('launcher.editHint') : t('launcher.reorderDisabled')}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <nav aria-label={t('redesign.categories')} className="hidden w-[220px] shrink-0 flex-col gap-1 overflow-y-auto @min-[900px]:flex">
          {filterEntries.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'flex h-10 items-center gap-2 rounded-xl px-3 text-left text-base transition-colors',
                filter === f.key ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              {f.icon && <Star size={16} className="shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              <span className="tabular text-sm opacity-70">{f.count}</span>
            </button>
          ))}
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] pt-1">
            {items === null ? (
              <StateView compact kind="loading" title={t('common.loading')} />
            ) : items.length === 0 ? (
              <StateView
                kind="empty"
                title={t('launcher.emptyTitle')}
                description={t('launcher.emptyBody')}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button icon={ScanSearch} variant="primary" onClick={() => setScanning(true)}>
                      {t('launcher.scan')}
                    </Button>
                    <Button icon={FilePlus2} onClick={() => void launcherService.pickFiles().then(addPaths)}>
                      {t('launcher.addFile')}
                    </Button>
                    <Button icon={FolderPlus} onClick={() => void launcherService.pickFolders().then(addPaths)}>
                      {t('launcher.addFolder')}
                    </Button>
                  </div>
                }
              />
            ) : visible.length === 0 ? (
              <StateView compact kind="empty" title={t('launcher.noMatch')} />
            ) : (
              <div className="flex flex-col gap-8">
                {showQuick && recentItems.length > 0 && (
                  <section aria-label={t('redesign.recentHero')}>
                    <h4 className="mb-3 px-2 text-sm font-semibold text-muted">{t('redesign.recentHero')}</h4>
                    <ul className="flex gap-4 overflow-x-auto pb-1">
                      {recentItems.map((item) => (
                        <li key={item.id} className="w-36 shrink-0">
                          {renderTile(item, { category: null, hero: true, interactive: false })}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {showQuick && topItems.length > 0 && (
                  <section aria-label={t('wide.launcherTop')}>
                    <h4 className="mb-3 px-2 text-sm font-semibold text-muted">{t('wide.launcherTop')}</h4>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                      {topItems.map((item) => (
                        <li key={item.id}>{renderTile(item, { category: null, interactive: false })}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {groups.map(({ category, list }) => (
                  <section key={category ?? '__all'} aria-label={category ?? undefined}>
                    {category !== null && (
                      <h4 className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-muted">
                        {category || t('launcher.uncategorized')}
                        <span className="tabular font-normal text-faint">{list.length}</span>
                      </h4>
                    )}
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                      {list.map((item) => {
                        const index = items.indexOf(item);
                        return (
                          <li
                            key={item.id}
                            draggable={editing && canReorder}
                            onDragStart={(e) => {
                              setDragId(item.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              if (dragId && dragId !== item.id) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = items.findIndex((i) => i.id === dragId);
                              if (from >= 0) reorder(from, index);
                              setDragId(null);
                            }}
                            onDragEnd={() => setDragId(null)}
                            className={cx(dragId === item.id && 'opacity-40', editId === item.id && 'col-span-2')}
                          >
                            {editId === item.id ? (
                              <EditCard
                                item={item}
                                categories={categories}
                                onCancel={() => setEditId(null)}
                                onSave={async (patch) => {
                                  if (await mutate(() => launcherService.update(patch), t('launcher.saved'))) setEditId(null);
                                }}
                              />
                            ) : (
                              renderTile(item, { category, interactive: true })
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-sm',
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-3 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

interface TileProps {
  item: LaunchItem;
  hero: boolean;
  editing: boolean;
  /** Gruplu görünümde kategori başlıkta yazdığı için gösterilmez. */
  showCategory: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onLaunch: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}

function LaunchTile({ item, hero, editing, showCategory, canMoveUp, canMoveDown, onLaunch, onToggleFavorite, onEdit, onRemove, onMove }: TileProps) {
  const Icon = launcherIcon(item.icon);
  const box = hero ? 'h-[72px] w-[72px]' : 'h-14 w-14';
  return (
    <div
      className={cx(
        'group relative flex h-full flex-col items-center gap-2 rounded-2xl p-3 text-center transition-all duration-150',
        item.exists ? 'hover:-translate-y-0.5 hover:bg-surface-3' : 'ring-1 ring-warn/50',
      )}
    >
      <button
        type="button"
        onClick={onLaunch}
        disabled={editing}
        title={`${item.name}\n${item.target ?? item.path}`}
        className="flex w-full flex-col items-center gap-2 disabled:cursor-default"
      >
        <span
          className={cx(
            'flex items-center justify-center rounded-2xl',
            box,
            !item.exists ? 'bg-warn/15 text-warn' : usesSystemIcon(item.icon) ? '' : 'bg-accent-soft text-accent',
          )}
        >
          {!item.exists ? (
            <AlertTriangle size={hero ? 36 : 28} strokeWidth={1.75} />
          ) : usesSystemIcon(item.icon) ? (
            <AppIcon path={item.path} fallback={Icon} size={hero ? 64 : 48} className="text-accent" />
          ) : (
            <Icon size={hero ? 36 : 28} strokeWidth={1.75} />
          )}
        </span>
        <span className="line-clamp-2 w-full text-sm leading-tight font-medium">{item.name}</span>
      </button>
      {((!item.exists) || (showCategory && item.category)) && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {!item.exists && <Badge tone="warn">{t('launcher.notFound')}</Badge>}
          {showCategory && item.category && <Badge>{item.category}</Badge>}
        </div>
      )}
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={item.favorite ? t('launcher.unfavorite') : t('launcher.favorite')}
        aria-pressed={item.favorite}
        title={item.favorite ? t('launcher.unfavorite') : t('launcher.favorite')}
        className={cx(
          'absolute top-2 right-2 rounded p-1',
          item.favorite ? 'text-warn' : 'text-faint opacity-0 group-hover:opacity-100 focus:opacity-100',
        )}
      >
        <Star size={14} fill={item.favorite ? 'currentColor' : 'none'} />
      </button>
      {editing && (
        <div className="flex flex-wrap items-center justify-center gap-0.5">
          <GripVertical size={14} className="text-faint" aria-hidden />
          <IconButton size="sm" icon={ArrowUp} label={t('launcher.moveUp')} disabled={!canMoveUp} onClick={() => onMove(-1)} />
          <IconButton size="sm" icon={ArrowDown} label={t('launcher.moveDown')} disabled={!canMoveDown} onClick={() => onMove(1)} />
          <IconButton size="sm" icon={Pencil} label={t('launcher.editItem')} onClick={onEdit} />
          <IconButton size="sm" icon={Trash2} tone="danger" label={t('common.remove')} onClick={onRemove} />
        </div>
      )}
    </div>
  );
}
function EditCard({
  item,
  categories,
  onSave,
  onCancel,
}: {
  item: LaunchItem;
  categories: string[];
  onSave: (patch: LaunchItemPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [icon, setIcon] = useState(item.icon);
  const listId = `cats-${item.id}`;
  return (
    <form
      className="flex h-full flex-col gap-1.5 rounded-xl border border-accent bg-surface-2 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: item.id, name, category, icon });
      }}
    >
      <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label={t('launcher.name')} placeholder={t('launcher.name')} className="h-7" />
      <TextInput
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label={t('launcher.category')}
        placeholder={t('launcher.category')}
        list={listId}
        className="h-7"
      />
      <datalist id={listId}>
        {[...new Set([...APP_CATEGORIES, ...categories])].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Select value={icon} onChange={(e) => setIcon(e.target.value)} aria-label={t('launcher.icon')} className="h-7">
        <option value="system">{t('launcher.systemIcon')}</option>
        {Object.keys(LAUNCHER_ICONS).map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>
      <div className="flex justify-end gap-1">
        <IconButton size="sm" icon={X} label={t('common.cancel')} onClick={onCancel} />
        <IconButton size="sm" icon={Check} label={t('common.save')} type="submit" />
      </div>
    </form>
  );
}
