import { Copy, ExternalLink, NotebookPen, Pin, PinOff, Search, Trash2, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Button, cx, IconButton, TextInput, Toggle } from '../../shared/ui/primitives';
import { describeError, SkeletonRows, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { captureNote, openInAppBrowser } from '../notebook/notebookService';
import type { PanelId } from '../window-manager/panels';
import { clipPreview, clipUrl, filterClips, lineCount, type ClipEntry } from './clipboard';
import { clipboardService, useClipboardHistory } from './clipboardService';

/** Pano geçmişi: kopyalanan metinler; tıklayınca panoya geri kopyalanır. */
export function ClipboardPanel({ onOpenPanel }: { onOpenPanel: (p: PanelId) => void }) {
  const { desktop, snapshot, loaded, error, run } = useClipboardHistory();
  const toast = useToast();
  const now = useNow(30_000);
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const groups = useMemo(() => filterClips(snapshot.entries, search), [snapshot.entries, search]);

  if (!desktop) {
    return <StateView kind="desktop" title={t('errors.desktopTitle')} description={t('errors.desktopBody')} />;
  }
  if (error) {
    const e = describeError(error);
    return <StateView kind={e.kind} title={e.title} description={e.description} />;
  }

  const fail = (err: unknown) => toast.push('error', describeError(err).description);
  const actions: RowActions = {
    copy: (c) =>
      void clipboardService
        .copy(c.id)
        .then(() => toast.push('success', t('clipboard.copied')))
        .catch((err: unknown) => toast.push('error', `${t('clipboard.copyFailed')}: ${describeError(err).description}`)),
    pin: (c) => void run(() => clipboardService.pin(c.id, !c.pinned)).catch(fail),
    remove: (c) => void run(() => clipboardService.remove(c.id)).catch(fail),
    toNote: (c) =>
      void captureNote(c.text)
        .then(() => toast.push('success', t('clipboard.savedAsNote')))
        .catch(fail),
    open: (url) => openInAppBrowser(url, onOpenPanel),
  };
  const all = [...groups.pinned, ...groups.recent];
  const selected = all.find((c) => c.id === selId) ?? all[0] ?? null;
  const unpinnedCount = snapshot.entries.filter((e) => !e.pinned).length;

  return (
    <div className="flex h-full flex-col">
      {/* Tek araç çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stroke bg-layer px-4 py-2">
        <div className="relative min-w-40 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clipboard.searchPlaceholder')}
            aria-label={t('clipboard.searchPlaceholder')}
            className="w-full pl-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t('common.clear')}
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-3 hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <label className="flex h-9 items-center gap-2 rounded-xl px-2 text-sm text-fg-2">
          {t('clipboard.recording')}
          <Toggle
            checked={!snapshot.paused}
            label={snapshot.paused ? t('clipboard.resume') : t('clipboard.pause')}
            onChange={(on) => void run(() => clipboardService.setPaused(!on)).catch(fail)}
          />
        </label>
        <IconButton
          icon={Trash2}
          tone="danger"
          active={confirmClear}
          disabled={unpinnedCount === 0}
          label={confirmClear ? t('clipboard.clearConfirm') : t('clipboard.clear')}
          onBlur={() => setConfirmClear(false)}
          onClick={() => {
            if (!confirmClear) {
              setConfirmClear(true);
              return;
            }
            setConfirmClear(false);
            void run(() => clipboardService.clear()).catch(fail);
          }}
        />
      </div>

      {snapshot.paused && (
        <div className="shrink-0 border-b border-stroke bg-warn/10 px-4 py-2 text-xs text-warn">{t('clipboard.paused')}</div>
      )}
      {loaded && !snapshot.available && (
        <div className="shrink-0 border-b border-stroke bg-warn/10 px-4 py-2 text-xs text-warn">{t('clipboard.unavailable')}</div>
      )}

      <div className="flex min-h-0 flex-1">
      <div className="selectable min-h-0 w-[min(380px,45%)] shrink-0 overflow-y-auto border-r border-stroke bg-layer">
        {!loaded ? (
          <SkeletonRows />
        ) : snapshot.entries.length === 0 ? (
          <StateView kind="empty" title={t('clipboard.emptyTitle')} description={t('clipboard.emptyBody')} />
        ) : groups.pinned.length + groups.recent.length === 0 ? (
          <StateView compact kind="empty" title={t('clipboard.noMatch')} />
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {groups.pinned.length > 0 && <SectionLabel>{t('clipboard.pinned')}</SectionLabel>}
            {groups.pinned.map((c) => (
              <ClipRow key={c.id} clip={c} now={now} actions={actions} selected={selected?.id === c.id} onSelect={() => setSelId(c.id)} />
            ))}
            {groups.pinned.length > 0 && groups.recent.length > 0 && <SectionLabel>{t('clipboard.recent')}</SectionLabel>}
            {groups.recent.map((c) => (
              <ClipRow key={c.id} clip={c} now={now} actions={actions} selected={selected?.id === c.id} onSelect={() => setSelId(c.id)} />
            ))}
          </div>
        )}
      </div>
      <section className="selectable flex min-w-0 flex-1 flex-col bg-bg">
        {selected ? (
          <ClipDetail clip={selected} now={now} actions={actions} />
        ) : (
          <StateView compact kind="empty" title={t('clipboard.emptyTitle')} />
        )}
      </section>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-stroke px-4 py-2 text-xs text-fg-3">
        <span className="truncate">{t('clipboard.privacy')}</span>
        <span className="shrink-0">{t('clipboard.count', { n: snapshot.entries.length })}</span>
      </footer>
    </div>
  );
}

interface RowActions {
  copy: (c: ClipEntry) => void;
  pin: (c: ClipEntry) => void;
  remove: (c: ClipEntry) => void;
  toNote: (c: ClipEntry) => void;
  open: (url: string) => void;
}

function ClipDetail({ clip, now, actions }: { clip: ClipEntry; now: number; actions: RowActions }) {
  const url = clipUrl(clip.text);
  const lines = lineCount(clip.text);
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stroke px-4 py-2">
        <Button size="sm" variant="primary" icon={Copy} onClick={() => actions.copy(clip)}>
          {t('clipboard.copy')}
        </Button>
        {url && (
          <Button size="sm" icon={ExternalLink} onClick={() => actions.open(url)}>
            {t('clipboard.openLink')}
          </Button>
        )}
        <Button size="sm" icon={NotebookPen} onClick={() => actions.toNote(clip)}>
          {t('clipboard.toNote')}
        </Button>
        <span className="flex-1" />
        <IconButton size="sm" icon={clip.pinned ? PinOff : Pin} active={clip.pinned} label={clip.pinned ? t('clipboard.unpin') : t('clipboard.pin')} onClick={() => actions.pin(clip)} />
        <IconButton size="sm" icon={Trash2} tone="danger" label={t('clipboard.delete')} onClick={() => actions.remove(clip)} />
      </div>
      <pre className="min-h-0 flex-1 overflow-auto px-5 py-4 font-mono text-sm break-words whitespace-pre-wrap text-fg">{clip.text}</pre>
      <p className="flex shrink-0 gap-3 border-t border-stroke px-4 py-2 text-xs text-fg-3">
        <span title={formatDateTime(clip.at)}>{formatRelative(clip.at, now)}</span>
        <span>{t('clipboard.chars', { n: clip.text.length })}</span>
        {lines > 1 && <span>{t('clipboard.lines', { n: lines })}</span>}
      </p>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">{children}</p>;
}

const ClipRow = memo(function ClipRow({ clip, now, selected, onSelect }: { clip: ClipEntry; now: number; actions: RowActions; selected: boolean; onSelect: () => void }) {
  const url = clipUrl(clip.text);
  const lines = lineCount(clip.text);
  return (
    <div className={cx('group relative flex items-start gap-2 rounded-lg px-3 py-2', selected ? 'bg-accent-soft' : 'hover:bg-control')}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span className={cx('line-clamp-3 text-sm break-words whitespace-pre-wrap', url ? 'text-accent' : 'text-fg')}>
          {clipPreview(clip.text, 600)}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-fg-3">
          {clip.pinned && <Pin size={12} className="mt-0.5 text-accent" />}
          <span title={formatDateTime(clip.at)}>{formatRelative(clip.at, now)}</span>
          <span>{t('clipboard.chars', { n: clip.text.length })}</span>
          {lines > 1 && <span>{t('clipboard.lines', { n: lines })}</span>}
        </span>
      </button>
    </div>
  );
});
