import { ArrowDown, ArrowUp, Link2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { IconButton, TextInput } from '../../../shared/ui/primitives';
import { useWidgetHost } from '../WidgetHost';
import type { WidgetProps, WidgetSettingsProps } from '../types';
import { SiteIcon } from '../../browser/SiteIcon';
import { addLink, linkTitle, MAX_LINKS, moveLink, normalizeLinkUrl, removeLink, type LinksConfig } from './links';

export { linksDefaults, sanitizeLinks } from './links';

/** Hızlı bağlantılar: tıklanınca uygulamanın tarayıcı sekmesinde açılır. */
export function LinksWidget({ config }: WidgetProps<LinksConfig>) {
  const host = useWidgetHost();
  if (config.links.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <Link2 size={20} className="text-fg-3" />
        <p className="text-sm text-fg-2">{t('widgets.links.empty')}</p>
        <p className="text-xs text-fg-3">{t('widgets.links.emptyBody')}</p>
      </div>
    );
  }
  return (
    <ul className="grid h-full auto-rows-min grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 overflow-y-auto p-3 pt-1">
      {config.links.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            title={l.url}
            onClick={() => host.openUrl(l.url)}
            className="flex h-[76px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-control-hover"
          >
            <SiteIcon url={l.url} size={28} lazy className="rounded-md" />
            <span className="w-full truncate text-center text-xs">{linkTitle(l)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LinksSettings({ config, setConfig }: WidgetSettingsProps<LinksConfig>) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const valid = normalizeLinkUrl(url) !== null;
  const links = config.links;
  const set = (next: LinksConfig['links']) => setConfig({ links: next });

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {links.map((l, i) => (
          <li key={l.id} className="flex items-center gap-1.5 text-sm">
            <SiteIcon url={l.url} size={16} className="rounded-sm" />
            <span className="min-w-0 flex-1 truncate" title={l.url}>
              {linkTitle(l)}
            </span>
            <IconButton size="sm" icon={ArrowUp} label={t('widgets.links.up')} disabled={i === 0} onClick={() => set(moveLink(links, l.id, -1))} />
            <IconButton size="sm" icon={ArrowDown} label={t('widgets.links.down')} disabled={i === links.length - 1} onClick={() => set(moveLink(links, l.id, 1))} />
            <IconButton size="sm" icon={X} tone="danger" label={t('common.remove')} onClick={() => set(removeLink(links, l.id))} />
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          set(addLink(links, title, url));
          setTitle('');
          setUrl('');
        }}
      >
        <TextInput value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('widgets.links.titlePlaceholder')} />
        <div className="flex gap-1.5">
          <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('widgets.links.urlPlaceholder')} className="flex-1" />
          <IconButton icon={Plus} label={t('common.add')} type="submit" disabled={!valid || links.length >= MAX_LINKS} />
        </div>
        {url.trim() !== '' && !valid && <p className="text-xs text-warn">{t('widgets.links.invalid')}</p>}
      </form>
    </div>
  );
}
