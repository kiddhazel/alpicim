import { Globe, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { cx, TextInput } from '../../shared/ui/primitives';
import type { Bookmark } from './browserService';
import { SiteIcon } from './SiteIcon';

/** Sekmenin başlangıç sayfası: arama/adres kutusu ve yer imleri. */
export function StartPage({
  bookmarks,
  onOpen,
  onRemove,
  autoFocus,
}: {
  bookmarks: Bookmark[];
  onOpen: (url: string) => void;
  onRemove: (url: string) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 pt-[12%] pb-6">
      <Globe size={34} strokeWidth={1.5} className="mb-3 text-accent" />
      <form
        className="w-full max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          onOpen(q);
        }}
      >
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('browser.searchPlaceholder')}
          aria-label={t('browser.searchPlaceholder')}
          className="h-11 w-full rounded-xl px-4 text-base"
          autoFocus={autoFocus}
        />
      </form>
      <ul className="mt-6 grid w-full max-w-xl grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
        {bookmarks.map((b) => (
          <li key={b.url} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(b.url)}
              title={b.url}
              className="flex w-full flex-col items-center gap-2 rounded-xl bg-surface-2 p-3 transition-colors hover:bg-surface-3"
            >
              <SiteIcon url={b.url} size={28} className="rounded" />
              <span className="w-full truncate text-center text-sm">{b.title}</span>
            </button>
            <button
              type="button"
              aria-label={t('common.remove')}
              onClick={() => onRemove(b.url)}
              className={cx('absolute top-1 right-1 rounded p-1 text-faint opacity-0 hover:text-down group-hover:opacity-100 focus:opacity-100')}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-md text-center text-xs text-faint">{t('browser.engineNote')}</p>
    </div>
  );
}
