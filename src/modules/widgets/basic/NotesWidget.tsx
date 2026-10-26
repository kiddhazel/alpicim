import { useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { obj, str, type WidgetProps } from '../types';

export interface NotesConfig {
  text: string;
}

export const MAX_NOTE = 20_000;
export const notesDefaults: NotesConfig = { text: '' };

export function sanitizeNotes(raw: unknown): NotesConfig {
  return { text: str(obj(raw).text, '', MAX_NOTE) };
}

/** Hızlı not: yazdıkça (0,6 sn gecikmeyle) kalıcı depoya kaydedilir. */
export function NotesWidget({ config, setConfig }: WidgetProps<NotesConfig>) {
  const [draft, setDraft] = useState(config.text);
  const timer = useRef(0);
  const dirty = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;

  // Başka pencereden gelen değişikliği, kullanıcı yazmıyorsa al.
  useEffect(() => {
    if (!dirty.current) setDraft(config.text);
  }, [config.text]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (dirty.current) setConfig({ text: latest.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <textarea
      value={draft}
      maxLength={MAX_NOTE}
      spellCheck={false}
      placeholder={t('widgets.notes.placeholder')}
      aria-label={t('widgets.notes.title')}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        dirty.current = true;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          setConfig({ text });
          dirty.current = false;
        }, 600);
      }}
      className="selectable h-full w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-3 focus:outline-none"
    />
  );
}
