import { ArrowLeft, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { Badge, Button, IconButton, Select, TextInput, Toggle } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { DEFAULT_FEEDS } from './defaultFeeds';
import { createFeed, probeFeed, validateFeedUrl } from './newsService';
import { NEWS_CATEGORIES, type Feed, type NewsCategory } from './types';

interface Props {
  feeds: Feed[];
  onChange: (next: Feed[] | ((prev: Feed[]) => Feed[])) => void;
  onClose: () => void;
}

/** Haber kaynaklarını açma/kapama, özel RSS ekleme ve kaldırma. */
export function FeedManager({ feeds, onChange, onClose }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<NewsCategory>('teknoloji');
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async () => {
    setFormError(null);
    const invalid = validateFeedUrl(url);
    if (invalid) {
      setFormError(t(invalid as MessageKey));
      return;
    }
    if (feeds.some((f) => f.url.trim() === url.trim())) {
      setFormError(t('feeds.duplicate'));
      return;
    }
    setChecking(true);
    try {
      const count = await probeFeed(url, category);
      onChange((list) => [...list, createFeed(name, url, category)]);
      toast.push('success', t('feeds.added', { n: count }));
      setName('');
      setUrl('');
    } catch (err) {
      const d = describeError(err);
      setFormError(`${t('feeds.probeFailed')} ${d.description}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
        <IconButton icon={ArrowLeft} label={t('common.back')} onClick={onClose} />
        <h3 className="flex-1 text-md font-semibold">{t('feeds.title')}</h3>
        <Button
          variant="ghost"
          icon={RotateCcw}
          onClick={() => {
            onChange([...DEFAULT_FEEDS]);
            toast.push('info', t('feeds.resetDone'));
          }}
        >
          {t('feeds.reset')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <form
          className="mb-5 rounded-xl border border-stroke bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <p className="mb-3 text-sm font-semibold">{t('feeds.addTitle')}</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('feeds.namePlaceholder')} aria-label={t('feeds.namePlaceholder')} />
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ornek.com/rss"
              aria-label={t('feeds.urlLabel')}
              required
              inputMode="url"
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value as NewsCategory)} aria-label={t('feeds.categoryLabel')}>
              {NEWS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`news.category.${c}`)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="primary" icon={checking ? Loader2 : Plus} disabled={checking || !url.trim()}>
              {checking ? t('feeds.checking') : t('common.add')}
            </Button>
          </div>
          {formError && <p role="alert" className="mt-2 text-sm text-down">{formError}</p>}
          <p className="mt-2 text-xs text-fg-3">{t('feeds.hint')}</p>
        </form>

        {NEWS_CATEGORIES.map((c) => {
          const group = feeds.filter((f) => f.category === c);
          if (group.length === 0) return null;
          return (
            <section key={c} className="mb-4">
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-3 uppercase">
                {t(`news.category.${c}`)}
              </h4>
              <ul className="divide-y divide-stroke overflow-hidden rounded-xl border border-stroke bg-card">
                {group.map((feed) => (
                  <li key={feed.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">
                        {feed.name} {feed.builtin && <Badge>{t('feeds.builtin')}</Badge>}
                      </p>
                      <p className="selectable truncate text-xs text-fg-3" title={feed.url}>
                        {feed.url}
                      </p>
                    </div>
                    <Toggle
                      checked={feed.enabled}
                      label={feed.enabled ? t('feeds.disable') : t('feeds.enable')}
                      onChange={(v) => onChange((list) => list.map((f) => (f.id === feed.id ? { ...f, enabled: v } : f)))}
                    />
                    {!feed.builtin && (
                      <IconButton
                        size="sm"
                        tone="danger"
                        icon={Trash2}
                        label={t('common.remove')}
                        onClick={() => onChange((list) => list.filter((f) => f.id !== feed.id))}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
