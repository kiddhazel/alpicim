import {
  AppWindow,
  Command,
  Globe,
  LayoutDashboard,
  Maximize,
  NotebookPen,
  Search,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { readKey } from '../../shared/lib/store';
import { isTauri } from '../../shared/lib/tauri';
import { cx } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { BROWSER_KEYS, sanitizeBookmarks, type Bookmark } from '../browser/browserService';
import { launcherService, type LaunchItem } from '../launcher/launcherService';
import { NOTEBOOK_KEY, notePreview, noteTitle, sanitizeNotebook, sortNotes, type Note } from '../notebook/notebook';
import { requestNotebook } from '../notebook/notebookService';
import { LAILA_CHAT_EVENT, LAILA_LEAVE_EVENT } from '../laila/lailaEvents';
import { screenshotService } from '../screenshot/screenshotService';
import { useSettings } from '../settings/settings';
import { WIDGETS } from '../widgets/registry';
import type { WidgetType } from '../widgets/types';
import { PANELS, type PanelId } from '../window-manager/panels';
import type { Workspace } from '../workspaces/workspaces';
import { useFocus } from '../focus/useFocus';
import { rankItems,type PaletteGroup, type PaletteItem } from './palette';

export interface PaletteCommands {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  docked: PanelId[];
  openPanel: (p: PanelId) => void;
  togglePanel: (p: PanelId) => void;
  switchWorkspace: (id: string) => void;
  addWidget: (type: WidgetType) => void;
  openUrlInBrowser: (url: string) => void;
  toggleFullscreen: () => void;
  hideApp: () => void;
  togglePerformance: () => void;
  nextTab: () => void;
  closeTab: () => void;
  toggleSplit: () => void;
}

const GROUP: Record<PaletteGroup, { key: MessageKey; icon: LucideIcon }> = {
  action: { key: 'palette.groups.action', icon: Zap },
  panel: { key: 'palette.groups.panel', icon: LayoutDashboard },
  workspace: { key: 'palette.groups.workspace', icon: Command },
  widget: { key: 'palette.groups.widget', icon: LayoutDashboard },
  app: { key: 'palette.groups.app', icon: AppWindow },
  bookmark: { key: 'palette.groups.bookmark', icon: Globe },
  note: { key: 'palette.groups.note', icon: NotebookPen },
};

/** Ctrl+K: uygulama, panel, widget, çalışma alanı, yer imi ve eylemleri bulup çalıştırır. */
export function CommandPalette({ commands, onClose }: { commands: PaletteCommands; onClose: () => void }) {
  const toast = useToast();
  const [settings] = useSettings();
  const { focus, toggle: toggleFocus } = useFocus();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [apps, setApps] = useState<LaunchItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setOverlay('palette', true);
    return () => setOverlay('palette', false);
  }, []);

  useEffect(() => {
    if (isTauri()) launcherService.list().then(setApps).catch(() => {});
    void readKey<unknown>(BROWSER_KEYS.bookmarks, null).then((raw) => setBookmarks(raw === null ? sanitizeBookmarks(null) : sanitizeBookmarks(raw)));
    void readKey<unknown>(NOTEBOOK_KEY, null).then((raw) => setNotes(sortNotes(sanitizeNotebook(raw).notes)));
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      { id: 'act:fullscreen', group: 'action', title: t('palette.toggleFullscreen'), keywords: 'tam ekran f11 monitör', run: commands.toggleFullscreen },
      { id: 'act:hide', group: 'action', title: t('palette.hideApp'), keywords: 'gizle tepsi', run: commands.hideApp },
      ...(isTauri()
        ? [
            {
              id: 'act:screenshot',
              group: 'action' as const,
              title: t('palette.screenshot'),
              keywords: 'ekran görüntüsü ekran alıntısı screenshot snip kırp',
              run: () => screenshotService.start().catch((err: unknown) => toast.push('error', `${t('screenshot.failed')}: ${describeError(err).description}`)),
            },
            {
              id: 'act:record',
              group: 'action' as const,
              title: t('palette.recordScreen'),
              keywords: 'ekran kaydı video kayıt record',
              run: () => screenshotService.openRecorder().catch(() => toast.push('error', t('screenshot.recordFailed'))),
            },
          ]
        : []),
      {
        id: 'act:perf',
        group: 'action',
        title: settings.performanceMode ? t('palette.perfOff') : t('palette.perfOn'),
        keywords: 'performans hız animasyon',
        run: commands.togglePerformance,
      },
      {
        id: 'act:focus',
        group: 'action',
        title: focus.on ? t('focus.paletteOff') : t('focus.paletteOn'),
        keywords: 'odak focus sessiz dikkat pomodoro',
        run: toggleFocus,
      },
      ...(settings.lailaEnabled
        ? [
            { id: 'act:laila-chat', group: 'action' as const, title: t('laila.paletteChat'), keywords: 'laila sohbet konuş', run: () => window.dispatchEvent(new Event(LAILA_CHAT_EVENT)) },
            ...(settings.lailaDesktop && isTauri()
              ? [{ id: 'act:laila-leave', group: 'action' as const, title: t('laila.paletteLeave'), keywords: 'laila dışarı masaüstü gez', run: () => window.dispatchEvent(new Event(LAILA_LEAVE_EVENT)) }]
              : []),
          ]
        : []),
      { id: 'act:nexttab', group: 'action', title: t('bar.paletteNextTab'), keywords: 'sekme sonraki ctrl tab', run: commands.nextTab },
      { id: 'act:closetab', group: 'action', title: t('bar.paletteCloseTab'), keywords: 'sekme kapat ctrl w', run: commands.closeTab },
      { id: 'act:split', group: 'action', title: t('bar.paletteSplit'), keywords: 'bölünmüş split iki panel', run: commands.toggleSplit },
      ...PANELS.map<PaletteItem>((p) => ({
        id: `panel:${p.id}`,
        group: 'panel',
        title: t(p.titleKey),
        subtitle: commands.docked.includes(p.id) ? t('palette.panelShown') : t('palette.panelHidden'),
        run: () => commands.openPanel(p.id),
      })),
      ...commands.workspaces.map<PaletteItem>((w) => ({
        id: `ws:${w.id}`,
        group: 'workspace',
        title: w.name,
        subtitle: w.id === commands.activeWorkspaceId ? t('palette.active') : t('palette.switchTo'),
        keywords: 'çalışma alanı',
        run: () => commands.switchWorkspace(w.id),
      })),
      ...WIDGETS.map<PaletteItem>((d) => ({
        id: `widget:${d.type}`,
        group: 'widget',
        title: t('palette.addWidget', { name: t(d.titleKey) }),
        subtitle: t(d.descriptionKey),
        keywords: 'widget ekle',
        run: () => commands.addWidget(d.type),
      })),
      ...apps.map<PaletteItem>((a) => ({
        id: `app:${a.id}`,
        group: 'app',
        title: a.name,
        subtitle: a.category,
        keywords: a.path,
        run: async () => {
          try {
            await launcherService.launch(a.id, settings.launcherFocusExisting);
          } catch (err) {
            toast.push('error', describeError(err).description);
          }
        },
      })),
      ...bookmarks.map<PaletteItem>((b) => ({
        id: `bm:${b.url}`,
        group: 'bookmark',
        title: b.title,
        subtitle: b.url,
        run: () => commands.openUrlInBrowser(b.url),
      })),
      {
        id: 'act:newnote',
        group: 'note',
        title: t('palette.newNote'),
        subtitle: t('palette.newNoteHint'),
        keywords: 'not ekle yaz',
        run: () => {
          void requestNotebook({ action: 'new' });
          commands.openPanel('notes');
        },
      },
      ...notes.map<PaletteItem>((n) => ({
        id: `note:${n.id}`,
        group: 'note',
        title: noteTitle(n) || t('notebook.untitled'),
        subtitle: notePreview(n) || undefined,
        keywords: n.body.slice(0, 600),
        run: () => {
          void requestNotebook({ action: 'open', id: n.id });
          commands.openPanel('notes');
        },
      })),
    ];
    return list;
  }, [commands, apps, bookmarks, notes, focus.on, toggleFocus, settings.performanceMode, settings.lailaEnabled, settings.lailaDesktop, settings.launcherFocusExisting, toast]);

  const results = useMemo(() => rankItems(items, query, 40), [items, query]);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    void item.run();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-6 pt-[12vh] backdrop-blur-md" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t('palette.title')}
        className="w-full max-w-xl glass overflow-hidden rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={20} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(results[index]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            className="h-14 flex-1 bg-transparent text-md text-fg placeholder:text-faint focus:outline-none"
          />
          <kbd className="rounded-md bg-surface-3 px-1.5 text-xs text-faint">Esc</kbd>
        </div>
        <ul ref={listRef} role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-faint">{t('palette.noResults')}</li>}
          {results.map((item, i) => {
            const g = GROUP[item.group];
            const Icon = item.id === 'act:fullscreen' ? Maximize : g.icon;
            return (
              <li key={item.id} data-index={i} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(item)}
                  className={cx('relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === index ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                >
                  {i === index && <span aria-hidden className="bg-accent-gradient absolute top-2 bottom-2 left-0 w-[3px] rounded-full" />}
                  <Icon size={18} className={i === index ? 'text-accent' : 'text-muted'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-faint">{item.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-faint">{t(g.key)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-5 py-2.5 text-xs text-faint">{t('palette.footer')}</p>
      </div>
    </div>
  );
}

