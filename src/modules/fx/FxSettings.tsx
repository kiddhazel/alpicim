import { t, type MessageKey } from '../../i18n';
import { Select, Toggle } from '../../shared/ui/primitives';
import { Group, Row } from '../settings/SettingsLayout';
import { useSettings } from '../settings/settings';
import { setFxPreview, useFxPreview, type FxPreview } from './preview';

const PREVIEW_IDS = ['dawn', 'day', 'sunset', 'night', 'halloween', 'republic', 'newYear', 'christmas', 'valentine', 'children', 'ramadan', 'kurban'] as const;

/** Ayarlar → Ortam bölümü (hava ve özel gün efektleri). */
export default function FxSettings() {
  const [settings, setSettings] = useSettings();
  const preview = useFxPreview();
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <Group title={t('fx.title')}>
      <Row label={t('fx.weather')} hint={t('fx.weatherHint')}>
        <Toggle checked={settings.fxWeather} label={t('fx.weather')} onChange={(v) => set('fxWeather', v)} />
      </Row>
      <Row label={t('fx.confetti')} hint={t('fx.confettiHint')}>
        <Toggle checked={settings.fxConfetti} label={t('fx.confetti')} onChange={(v) => set('fxConfetti', v)} />
      </Row>
      <Row label={t('fx.ambient')} hint={t('fx.ambientHint')}>
        <Toggle checked={settings.fxAmbient} label={t('fx.ambient')} onChange={(v) => set('fxAmbient', v)} />
      </Row>
      <Row label={t('fx.holidays')} hint={t('fx.holidaysHint')}>
        <Toggle checked={settings.fxHolidays} label={t('fx.holidays')} onChange={(v) => set('fxHolidays', v)} />
      </Row>
      <Row label={t('fx.holidayDecor')} hint={t('fx.holidayDecorHint')}>
        <Toggle checked={settings.fxHolidayDecor} label={t('fx.holidayDecor')} onChange={(v) => set('fxHolidayDecor', v)} />
      </Row>
      <Row label={t('fx.preview')} hint={t('fx.previewHint')}>
        <Select value={preview} aria-label={t('fx.preview')} onChange={(e) => setFxPreview(e.target.value as FxPreview)}>
          <option value="none">{t('fx.previewNone')}</option>
          {PREVIEW_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`fx.names.${id}` as MessageKey)}
            </option>
          ))}
        </Select>
      </Row>
    </Group>
  );
}
