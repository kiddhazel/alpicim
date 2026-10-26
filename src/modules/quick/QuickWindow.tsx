import { AppWindow, Calculator, ClipboardList, LayoutDashboard, NotebookPen, Search, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { readKey, writeKey } from '../../shared/lib/store';
import { isTauri } from '../../shared/lib/tauri';
import { cx } from '../../shared/ui/primitives';
import { clipPreview, EMPTY_SNAPSHOT, type ClipEntry } from '../clipboard/clipboard';
import { clipboardService } from '../clipboard/clipboardService';
import { subscribe } from '../display/displayService';
import { launcherService, type LaunchItem } from '../launcher/launcherService';
import { MARKET_KEYS } from '../markets/marketService';
import type { Quote } from '../markets/types';
import { NOTEBOOK_KEY, noteTitle, notePreview, sanitizeNotebook, sortNotes, type Note } from '../notebook/notebook';
import { useSettings } from '../settings/settings';
import { useEnabledPanels, useModules } from '../../core/modules/useModules';
import { answerQuery, rankQuick, ratesFromReference, recentClips, type QuickEntry, type QuickKind } from './quickLogic';
import { parseMode, QUICK_EVENT, QUICK_REQUEST_KEY, quickService, type QuickMode, type QuickRequest } from './quickService';

const KIND_ICON: Record<QuickKind, LucideIcon> = {
  panel: LayoutDashboard,
  app: AppWindow,
  note: NotebookPen,
  action: Search,
};

interface Row {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tag: string;
  run: () => void | Promise<void>;
}

/** "quick" penceresi: Spotlight (arama/hesap/çevirme) ve hızlı pano. Kenarlıksız, saydam, odak kaybında Rust gizler. */
export function QuickWindow() {
  const [settings] = useSettings();
  const panels = useEnabledPanels();
  const { isEnabled } = useModules();
  const [mode, setMode] = useState<QuickMode>('search');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [apps, setApps] = useState<LaunchItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('laila-window'); // saydam zemin (index.css)
  }, []);

  const refresh = useCallback(() => {
    setQuery('');
    setIndex(0);
    setCopied(false);
    if (isTauri()) {
      launcherService.list().then(setApps).catch(() => {});
      clipboardService.list().then((s) => setClips(s.entries)).catch(() => setClips(EMPTY_SNAPSHOT.entries));
    }
    void readKey<unknown>(NOTEBOOK_KEY, null).then((raw) => setNotes(sortNotes(sanitizeNotebook(raw).notes)));
    void readKey<{ reference?: { data?: Quote[] } | null }>(MARKET_KEYS.cache, {}).then((c) => setQuotes(c.reference?.data ?? []));
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  useEffect(() => {
    if (isTauri()) void quickService.mode().then(setMode).catch(() => {});
    refresh();
    const off = subscribe<unknown>(QUICK_EVENT, (raw) => {
      setMode(parseMode(raw));
      refresh();
    });
    const onFocus = () => inputRef.current?.focus();
    window.addEventListener('focus', onFocus);
    return () => {
      off();
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const hide = useCallback(() => void quickService.hide().catch(() => {}), []);

  const openMain = useCallback((req: Omit<QuickRequest, 'at'>) => {
    void writeKey<QuickRequest>(QUICK_REQUEST_KEY, { ...req, at: Date.now() });
    void quickService.openMain().catch(() => {});
  }, []);

  const rates = useMemo(() => ratesFromReference(quotes), [quotes]);
  const answer = useMemo(() => (mode === 'search' ? answerQuery(query, rates) : null), [mode, query, rates]);

  const entries = useMemo<QuickEntry[]>(
    () => [
      ...panels.map<QuickEntry>((p) => ({ id: `panel:${p.id}`, kind: 'panel', title: t(p.titleKey), ref: p.id, keywords: 'panel aç' })),
      ...(isEnabled('launcher') ? apps : []).map<QuickEntry>((a) => ({ id: `app:${a.id}`, kind: 'app', title: a.name, subtitle: a.category, keywords: a.path, ref: a.id })),
      ...(isEnabled('notes') ? notes : []).map<QuickEntry>((n) => ({
        id: `note:${n.id}`,
        kind: 'note',
        title: noteTitle(n) || t('spotlight.noteUntitled'),
        subtitle: notePreview(n) || undefined,
        keywords: n.body.slice(0, 400),
        ref: n.id,
      })),
    ],
    [panels, isEnabled, apps, notes],
  );

  const rows = useMemo<Row[]>(() => {
    if (mode === 'clipboard') {
      return recentClips(clips, query, 10).map<Row>((c) => ({
        id: c.id,
        icon: ClipboardList,
        title: clipPreview(c.text, 120),
        tag: c.pinned ? '📌' : '',
        run: async () => {
          await clipboardService.copy(c.id);
          setCopied(true);
          window.setTimeout(hide, 900);
        },
      }));
    }
    const list: Row[] = [];
    if (answer) {
      list.push({
        id: 'answer',
        icon: Calculator,
        title: answer.text,
        subtitle: `${answer.detail} · ${t('spotlight.copyAnswer')}`,
        tag: '',
        run: async () => {
          try {
            await navigator.clipboard.writeText(answer.copy);
          } catch {
            /* pano yazılamadıysa yine de kapat */
          }
          hide();
        },
      });
    }
    for (const e of rankQuick(entries, query, 8)) {
      list.push({
        id: e.id,
        icon: KIND_ICON[e.kind],
        title: e.title,
        subtitle: e.subtitle,
        tag: t(`spotlight.group.${e.kind}`),
        run: async () => {
          if (e.kind === 'panel') openMain({ kind: 'panel', id: e.ref });
          else if (e.kind === 'note') openMain({ kind: 'note', id: e.ref });
          else if (e.kind === 'app') {
            hide();
            await launcherService.launch(e.ref, settings.launcherFocusExisting).catch(() => {});
          }
        },
      });
    }
    return list;
  }, [mode, clips, query, answer, entries, hide, openMain, settings.launcherFocusExisting]);

  useEffect(() => setIndex(0), [query, mode]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (row: Row | undefined) => {
    if (row) void row.run();
  };

  const clipMode = mode === 'clipboard';
  const emptyText = clipMode ? t('spotlight.noClips') : query.trim() ? t('spotlight.noResults') : '';

  return (
    <div className="flex h-screen w-screen items-start justify-center p-3" onKeyDown={(e) => e.key === 'Escape' && hide()}>
      <div role="dialog" aria-label={t('spotlight.placeholder')} className="flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-stroke-strong shadow-[var(--shadow-pop)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-stroke px-5">
          {clipMode ? <ClipboardList size={20} className="text-fg-3" /> : <Search size={20} className="text-fg-3" />}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(rows.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(rows[index]);
              }
            }}
            placeholder={clipMode ? t('spotlight.clipPlaceholder') : t('spotlight.placeholder')}
            aria-label={clipMode ? t('spotlight.clipPlaceholder') : t('spotlight.placeholder')}
            className="h-14 flex-1 bg-transparent text-md text-fg placeholder:text-fg-3 focus:outline-none"
          />
          <kbd className="rounded-md bg-control px-1.5 text-xs text-fg-3">Esc</kbd>
        </div>
        <ul ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {rows.length === 0 && emptyText && <li className="px-3 py-8 text-center text-sm text-fg-3">{emptyText}</li>}
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <li key={row.id} data-index={i} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(row)}
                  className={cx('relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === index ? 'bg-accent-soft' : 'hover:bg-card-hover')}
                >
                  <Icon size={18} className={i === index ? 'text-accent' : 'text-fg-2'} />
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate', row.id === 'answer' ? 'text-lg font-semibold' : 'text-base')}>{row.title}</span>
                    {row.subtitle && <span className="block truncate text-xs text-fg-3">{row.subtitle}</span>}
                  </span>
                  {row.tag && <span className="shrink-0 text-xs text-fg-3">{row.tag}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={cx('shrink-0 border-t border-stroke px-5 py-2.5 text-xs', copied ? 'text-up' : 'text-fg-3')}>
          {copied ? t('spotlight.copied') : clipMode ? `${t('spotlight.footer')} · ${t('spotlight.clipHint')}` : t('spotlight.footer')}
        </p>
      </div>
    </div>
  );
}

