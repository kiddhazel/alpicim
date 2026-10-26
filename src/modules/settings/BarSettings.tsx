import { t } from '../../i18n';
import { Segmented, Select, Toggle } from '../../shared/ui/primitives';
import { NEWS_CATEGORIES, type NewsCategory } from '../news/types';
import { LIMITS, useSettings, type TickerSpeed } from './settings';
import { Group, Row } from './SettingsLayout';

const COUNTS = Array.from({ length: LIMITS.tickerQuotes.max - LIMITS.tickerQuotes.min + 1 }, (_, i) => i + LIMITS.tickerQuotes.min);

/** Alt çubuk: haber/piyasa şeridi ve mini oynatıcı tercihleri. */
export function BarSettings() {
  const [settings, setSettings] = useSettings();
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <Group title={t('bar.title')}>
      <Row label={t('bar.ticker')} hint={t('bar.tickerHint')}>
        <Toggle checked={settings.barTicker} label={t('bar.ticker')} onChange={(v) => setSettings((s) => ({ ...s, barTicker: v, barTickerSet: true }))} />
      </Row>
      <Row label={t('bar.player')} hint={t('bar.playerHint')}>
        <Toggle checked={settings.barPlayer} label={t('bar.player')} onChange={(v) => set('barPlayer', v)} />
      </Row>
      <Row label={t('bar.speed')}>
        <Segmented<TickerSpeed>
          label={t('bar.speed')}
          value={settings.tickerSpeed}
          onChange={(v) => set('tickerSpeed', v)}
          options={[
            { value: 'slow', label: t('bar.speedSlow') },
            { value: 'normal', label: t('bar.speedNormal') },
            { value: 'fast', label: t('bar.speedFast') },
          ]}
        />
      </Row>
      <Row label={t('bar.category')} hint={t('bar.categoryHint')}>
        <Select
          value={settings.tickerCategory}
          onChange={(e) => set('tickerCategory', e.target.value as NewsCategory | 'all')}
          aria-label={t('bar.category')}
        >
          <option value="all">{t('news.category.all')}</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`news.category.${c}`)}
            </option>
          ))}
        </Select>
      </Row>
      <Row label={t('bar.quotes')} hint={t('bar.quotesHint')}>
        <Select value={String(settings.tickerQuotes)} onChange={(e) => set('tickerQuotes', Number(e.target.value))} aria-label={t('bar.quotes')}>
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Row>
    </Group>
  );
}
