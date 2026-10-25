import { ArrowUpRight, Pin, Send } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { Button, cx } from '../../../shared/ui/primitives';
import { useToast } from '../../../shared/ui/Toast';
import { addNote, MAX_BODY, NOTE_HUE, noteTitle, sortNotes } from '../../notebook/notebook';
import { requestNotebook, useNotebook } from '../../notebook/notebookService';
import { useWidgetHost } from '../WidgetHost';
import type { WidgetProps } from '../types';

export type QuickNoteConfig = Record<string, never>;

/** Hızlı not: yazılanı Notlar paneline yeni not olarak ekler; son notlara kısayol. */
export function QuickNoteWidget({ size }: WidgetProps<QuickNoteConfig>) {
  const host = useWidgetHost();
  const toast = useToast();
  const [notebook, setNotebook] = useNotebook();
  const [draft, setDraft] = useState('');
  const recent = sortNotes(notebook.notes)
    .filter((n) => noteTitle(n))
    .slice(0, Math.max(0, size.h - 2) * 2);

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    setNotebook((nb) => addNote(nb, text).notebook);
    setDraft('');
    toast.push('success', t('widgets.quicknote.saved'));
  };

  const open = (id?: string) => {
    if (id) void requestNotebook({ action: 'open', id });
    host.openPanel('notes');
  };

  return (
    <div className="flex h-full flex-col gap-2 px-4 pb-3">
      <textarea
        value={draft}
        maxLength={MAX_BODY}
        spellCheck={false}
        placeholder={t('widgets.quicknote.placeholder')}
        aria-label={t('widgets.quicknote.title')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
        className={cx(
          'selectable w-full resize-none rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] placeholder:text-faint focus:ring-2 focus:ring-accent/40 focus:outline-none',
          recent.length > 0 ? 'h-20 shrink-0' : 'min-h-0 flex-1',
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => open()} className="inline-flex items-center gap-1 text-xs text-faint hover:text-accent">
          {t('widgets.quicknote.openAll', { n: notebook.notes.length })}
          <ArrowUpRight size={12} />
        </button>
        <Button variant="primary" icon={Send} onClick={save} disabled={!draft.trim()}>
          {t('widgets.quicknote.save')}
        </Button>
      </div>
      {recent.length > 0 && (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {recent.map((n) => {
            const hue = NOTE_HUE[n.color];
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-surface-3"
                >
                  <span
                    aria-hidden
                    className={cx('h-2 w-2 shrink-0 rounded-full', !hue && 'bg-surface-3')}
                    style={hue ? { backgroundColor: hue } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate">{noteTitle(n)}</span>
                  {n.pinned && <Pin size={12} className="shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
