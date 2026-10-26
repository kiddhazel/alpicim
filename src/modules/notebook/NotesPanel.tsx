import { ArrowLeft, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { onKeyChanged, readKey } from '../../shared/lib/store';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Button, cx, IconButton, Segmented, TextInput } from '../../shared/ui/primitives';
import { StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useElementWidth } from '../news/NewsReader';
import type { PanelId } from '../window-manager/panels';
import { MarkdownView } from './MarkdownView';
import {
  addNote,
  MAX_BODY,
  newNoteId,
  NOTE_COLORS,
  NOTE_HUE,
  NOTEBOOK_REQUEST_KEY,
  noteTitle,
  notePreview,
  removeNote,
  sanitizeRequest,
  searchNotes,
  setBody,
  setColor,
  sortNotes,
  taskProgress,
  togglePin,
  toggleTask,
  wordCount,
  type Note,
} from './notebook';
import { openInAppBrowser, useNotebook } from './notebookService';

type Mode = 'edit' | 'preview' | 'split';

const WIDE_MIN = 720;
const SPLIT_MIN = 1100;
/** Bu süreden eski istekler (ör. önceki oturumdan kalan) yok sayılır. */
const REQUEST_FRESH_MS = 15_000;

/** Not defteri: liste + düzenleyici + Markdown önizleme. Yazdıkça kaydedilir. */
export function NotesPanel({ onOpenPanel }: { onOpenPanel: (p: PanelId) => void }) {
  const [notebook, setNotebook, loaded] = useNotebook();
  const toast = useToast();
  const now = useNow();
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const wide = width === 0 || width >= WIDE_MIN;
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('edit');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draftRef = useRef<{ id: string; body: string } | null>(null);
  const handledRequest = useRef(0);
  const [focusSignal, setFocusSignal] = useState(0);

  const sorted = useMemo(() => sortNotes(notebook.notes), [notebook.notes]);
  const visible = useMemo(() => searchNotes(sorted, search), [sorted, search]);
  const selected = notebook.notes.find((n) => n.id === selectedId) ?? (selectedId === null ? (sorted[0] ?? null) : null);
  const effectiveMode: Mode = mode === 'split' && width > 0 && width < SPLIT_MIN ? 'edit' : mode;

  useEffect(() => setConfirmDelete(false), [selected?.id]);

  /** Seçimden çıkan not boş kaldıysa silinir (yanlışlıkla oluşturulan boş notlar birikmesin). */
  const dropIfEmpty = useCallback(
    (leavingId: string | undefined, nextId: string | null) => {
      if (!leavingId || leavingId === nextId) return;
      const draft = draftRef.current;
      const leavingBody = draft && draft.id === leavingId ? draft.body : notebook.notes.find((n) => n.id === leavingId)?.body;
      if (leavingBody !== undefined && !leavingBody.trim()) setNotebook((nb) => removeNote(nb, leavingId));
    },
    [notebook.notes, setNotebook],
  );

  const select = useCallback(
    (id: string) => {
      dropIfEmpty(selected?.id, id);
      setSelectedId(id);
      setShowList(false);
    },
    [dropIfEmpty, selected?.id],
  );

  const createNote = useCallback(() => {
    dropIfEmpty(selected?.id, null);
    const id = newNoteId();
    setNotebook((nb) => addNote(nb, '', Date.now(), id).notebook);
    setSelectedId(id);
    setSearch('');
    setShowList(false);
    setMode((m) => (m === 'preview' ? 'edit' : m));
    setFocusSignal((n) => n + 1);
  }, [dropIfEmpty, selected?.id, setNotebook]);

  // Paletten / widget'tan gelen istekler.
  const handleRequest = useCallback(
    (raw: unknown) => {
      const req = sanitizeRequest(raw);
      if (!req || req.at <= handledRequest.current || Date.now() - req.at > REQUEST_FRESH_MS) return;
      handledRequest.current = req.at;
      if (req.action === 'new') createNote();
      else if (req.id) {
        setSearch('');
        select(req.id);
      }
    },
    [createNote, select],
  );
  const handleRef = useRef(handleRequest);
  handleRef.current = handleRequest;
  useEffect(() => {
    if (!loaded) return;
    const pull = () => void readKey<unknown>(NOTEBOOK_REQUEST_KEY, null).then((r) => handleRef.current(r));
    pull();
    return onKeyChanged(NOTEBOOK_REQUEST_KEY, pull);
  }, [loaded]);

  const saveBody = useCallback((id: string, body: string) => setNotebook((nb) => setBody(nb, id, body)), [setNotebook]);
  const openLink = useCallback((url: string) => openInAppBrowser(url, onOpenPanel), [onOpenPanel]);

  const remove = () => {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const index = visible.findIndex((n) => n.id === selected.id);
    const next = visible[index + 1] ?? visible[index - 1] ?? null;
    setNotebook((nb) => removeNote(nb, selected.id));
    setSelectedId(next?.id ?? null);
    draftRef.current = null;
    toast.push('info', t('notebook.deleted'));
    if (!next) setShowList(true);
  };

  const listVisible = wide || showList || !selected;
  const editorVisible = wide || !listVisible;
  const draftBody = draftRef.current && selected && draftRef.current.id === selected.id ? draftRef.current.body : (selected?.body ?? '');
  const [tasksDone, tasksTotal] = taskProgress(draftBody);

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          createNote();
        }
      }}
    >
      {/* Araç çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stroke bg-layer px-4 py-2">
        {!wide && !listVisible && (
          <IconButton icon={ArrowLeft} label={t('notebook.back')} onClick={() => setShowList(true)} />
        )}
        {listVisible && (
          <div className="relative min-w-40 flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('notebook.searchPlaceholder')}
              aria-label={t('notebook.searchPlaceholder')}
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
        )}
        {!listVisible && <div className="flex-1" />}
        {editorVisible && selected && (
          <>
            <Segmented
              label={t('notebook.modeLabel')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'edit', label: t('notebook.edit') },
                { value: 'preview', label: t('notebook.preview') },
                ...(width === 0 || width >= SPLIT_MIN ? [{ value: 'split' as const, label: t('notebook.split') }] : []),
              ]}
            />
            <IconButton
              icon={selected.pinned ? PinOff : Pin}
              active={selected.pinned}
              label={selected.pinned ? t('notebook.unpin') : t('notebook.pin')}
              onClick={() => setNotebook((nb) => togglePin(nb, selected.id))}
            />
            <IconButton
              icon={Trash2}
              tone="danger"
              active={confirmDelete}
              label={confirmDelete ? t('notebook.deleteConfirm') : t('notebook.delete')}
              onClick={remove}
              onBlur={() => setConfirmDelete(false)}
            />
          </>
        )}
        <Button variant="primary" icon={Plus} onClick={createNote} title={`${t('notebook.newNote')} (Ctrl+N)`}>
          {t('notebook.newNote')}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {listVisible && (
          <div className={cx('min-h-0 overflow-y-auto', wide ? 'w-80 shrink-0 border-r border-stroke bg-layer' : 'flex-1 bg-layer')}>
            {!loaded ? null : notebook.notes.length === 0 ? (
              <StateView
                kind="empty"
                title={t('notebook.emptyTitle')}
                description={t('notebook.emptyBody')}
                action={
                  <Button variant="primary" icon={Plus} onClick={createNote}>
                    {t('notebook.newNote')}
                  </Button>
                }
              />
            ) : visible.length === 0 ? (
              <StateView compact kind="empty" title={t('notebook.noMatch')} />
            ) : (
              <NoteList notes={visible} selectedId={selected?.id ?? null} now={now} onSelect={select} />
            )}
          </div>
        )}
        {editorVisible && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                mode={effectiveMode}
                focusSignal={focusSignal}
                draftRef={draftRef}
                onSave={saveBody}
                onOpenLink={openLink}
              />
            ) : (
              loaded && notebook.notes.length > 0 && <StateView kind="empty" title={t('notebook.selectHint')} />
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-stroke px-4 py-2 text-xs text-fg-3">
        {selected && editorVisible ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div role="radiogroup" aria-label={t('notebook.color')} className="flex items-center gap-1">
              {NOTE_COLORS.map((c) => {
                const hue = NOTE_HUE[c];
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected.color === c}
                    title={t(`notebook.colors.${c}`)}
                    aria-label={t(`notebook.colors.${c}`)}
                    onClick={() => setNotebook((nb) => setColor(nb, selected.id, c))}
                    className={cx(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-control',
                      selected.color === c && 'bg-control',
                    )}
                  >
                    <span
                      className={cx('h-3 w-3 rounded-full', !hue && 'border border-stroke-strong')}
                      style={hue ? { backgroundColor: hue } : undefined}
                    />
                  </button>
                );
              })}
            </div>
            <span title={formatDateTime(selected.createdAt)}>{t('notebook.created', { time: formatRelative(selected.createdAt, now) })}</span>
            <span title={formatDateTime(selected.updatedAt)}>{t('notebook.updated', { time: formatRelative(selected.updatedAt, now) })}</span>
            <span>{t('notebook.words', { n: wordCount(draftBody) })}</span>
            {tasksTotal > 0 && <span>{t('notebook.tasks', { done: tasksDone, total: tasksTotal })}</span>}
          </div>
        ) : (
          <span />
        )}
        <span>{t('notebook.count', { n: notebook.notes.length })}</span>
      </footer>
    </div>
  );
}

const NoteList = memo(function NoteList({
  notes,
  selectedId,
  now,
  onSelect,
}: {
  notes: Note[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
}) {
  const firstUnpinned = notes.findIndex((n) => !n.pinned);
  const hasPinned = notes[0]?.pinned === true;
  return (
    <ul className="flex flex-col gap-1 p-2">
      {notes.map((n, i) => {
        const hue = NOTE_HUE[n.color];
        const title = noteTitle(n);
        const preview = notePreview(n);
        const active = n.id === selectedId;
        return (
          <li key={n.id}>
            {hasPinned && i === 0 && <SectionLabel>{t('notebook.pinned')}</SectionLabel>}
            {hasPinned && i === firstUnpinned && <SectionLabel>{t('notebook.others')}</SectionLabel>}
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              aria-current={active ? 'true' : undefined}
              style={hue ? { borderLeftColor: hue } : undefined}
              className={cx(
                'w-full rounded-xl border-l-[3px] px-3 py-2.5 text-left transition-colors',
                hue ? '' : 'border-l-transparent',
                active ? 'bg-accent-soft' : 'hover:bg-control',
              )}
            >
              <span className="flex items-center gap-1.5">
                {n.pinned && <Pin size={12} className="shrink-0 text-accent" />}
                <span className={cx('truncate text-base font-medium', !title && 'text-fg-3 italic')}>
                  {title || t('notebook.untitled')}
                </span>
              </span>
              <span className="mt-0.5 flex gap-2 text-xs text-fg-3">
                <span className="shrink-0">{formatRelative(n.updatedAt, now)}</span>
                <span className="truncate">{preview || (title ? '' : t('notebook.empty'))}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

function SectionLabel({ children }: { children: string }) {
  return <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-3 uppercase">{children}</p>;
}

/** Tek notun düzenleyicisi. Taslak yerel tutulur, 400 ms gecikmeyle (ve ayrılırken hemen) kaydedilir. */
function NoteEditor({
  note,
  mode,
  focusSignal,
  draftRef,
  onSave,
  onOpenLink,
}: {
  note: Note;
  mode: Mode;
  focusSignal: number;
  draftRef: MutableRefObject<{ id: string; body: string } | null>;
  onSave: (id: string, body: string) => void;
  onOpenLink: (url: string) => void;
}) {
  const [draft, setDraft] = useState(note.body);
  const dirty = useRef(false);
  const timer = useRef(0);
  const latest = useRef({ draft, onSave });
  latest.current = { draft, onSave };
  const area = useRef<HTMLTextAreaElement>(null);
  /** Programla değiştirilen metinden sonra imlecin gideceği konum (React değeri yazınca imleç sona kaçar). */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    area.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [draft]);

  // Başka pencereden gelen değişikliği, kullanıcı yazmıyorsa al.
  useEffect(() => {
    if (!dirty.current) setDraft(note.body);
  }, [note.body]);

  useEffect(() => {
    if (focusSignal > 0 || !note.body) area.current?.focus();
  }, [focusSignal, note.body]);

  useEffect(() => {
    const id = note.id;
    return () => {
      window.clearTimeout(timer.current);
      if (dirty.current) latest.current.onSave(id, latest.current.draft);
    };
  }, [note.id]);

  const change = (body: string, immediate = false) => {
    setDraft(body);
    draftRef.current = { id: note.id, body };
    dirty.current = true;
    window.clearTimeout(timer.current);
    const commit = () => {
      onSave(note.id, body);
      dirty.current = false;
    };
    if (immediate) commit();
    else timer.current = window.setTimeout(commit, 400);
  };

  const editor = (
    <textarea
      ref={area}
      value={draft}
      maxLength={MAX_BODY}
      spellCheck={false}
      placeholder={t('notebook.placeholder')}
      aria-label={t('notebook.edit')}
      onChange={(e) => change(e.target.value)}
      onKeyDown={(e) => {
        // Liste satırında Enter: bir sonraki satıra aynı işareti ekle.
        if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey) return;
        const el = e.currentTarget;
        const start = el.selectionStart;
        if (start !== el.selectionEnd) return;
        const lineStart = draft.lastIndexOf('\n', start - 1) + 1;
        const line = draft.slice(lineStart, start);
        const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)[.)] )(.*)$/.exec(line);
        if (!m) return;
        e.preventDefault();
        if (!m[4]) {
          // Boş liste öğesi: işareti kaldırıp listeden çık.
          pendingCaret.current = lineStart;
          change(draft.slice(0, lineStart) + draft.slice(start));
          return;
        }
        const marker = m[3] ? `${Number(m[3]) + 1}${(m[2] as string).slice(m[3].length)}` : (m[2] as string).replace(/\[[xX]\]/, '[ ]');
        const insert = `\n${m[1]}${marker}`;
        pendingCaret.current = start + insert.length;
        change(draft.slice(0, start) + insert + draft.slice(start));
      }}
      className="selectable h-full w-full resize-none bg-transparent px-5 py-4 font-mono text-base leading-relaxed text-fg placeholder:text-fg-3 focus:outline-none"
    />
  );

  const preview = (
    <div className="h-full overflow-y-auto px-6 py-4">
      <MarkdownView source={draft} onToggleTask={(line) => change(toggleTask(draft, line), true)} onOpenLink={onOpenLink} />
    </div>
  );

  if (mode === 'edit') return editor;
  if (mode === 'preview') return preview;
  return (
    <div className="grid h-full min-h-0 grid-cols-2">
      <div className="min-h-0 border-r border-stroke">{editor}</div>
      <div className="min-h-0">{preview}</div>
    </div>
  );
}
