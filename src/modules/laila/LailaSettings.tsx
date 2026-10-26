import { t } from '../../i18n';
import { Segmented, Toggle } from '../../shared/ui/primitives';
import { Group, Row } from '../settings/SettingsLayout';
import { useSettings } from '../settings/settings';
import type { Chattiness } from './brain';

/** Ayarlar → Laila bölümü. */
export default function LailaSettings() {
  const [settings, setSettings] = useSettings();
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <Group title={t('laila.settingsTitle')}>
      <Row label={t('laila.enabled')} hint={t('laila.enabledHint')}>
        <Toggle checked={settings.lailaEnabled} label={t('laila.enabled')} onChange={(v) => set('lailaEnabled', v)} />
      </Row>
      <Row label={t('laila.desktop')} hint={t('laila.desktopHint')}>
        <Toggle checked={settings.lailaDesktop} label={t('laila.desktop')} onChange={(v) => set('lailaDesktop', v)} />
      </Row>
      <Row label={t('laila.chatty')}>
        <Segmented<Chattiness>
          label={t('laila.chatty')}
          value={settings.lailaChat}
          options={[
            { value: 'quiet', label: t('laila.chattyQuiet') },
            { value: 'normal', label: t('laila.chattyNormal') },
            { value: 'chatty', label: t('laila.chattyChatty') },
          ]}
          onChange={(v) => set('lailaChat', v)}
        />
      </Row>
      <Row label={t('laila.reminders')} hint={t('laila.remindersHint')}>
        <Toggle checked={settings.lailaReminders} label={t('laila.reminders')} onChange={(v) => set('lailaReminders', v)} />
      </Row>
      {settings.lailaReminders && (
        <>
          <Row label={t('laila.eyeEvery')}>
            <Segmented<'20' | '40' | '60'>
              label={t('laila.eyeEvery')}
              value={String(settings.lailaEyeMin) as '20' | '40' | '60'}
              options={[
                { value: '20', label: t('laila.minutes', { n: 20 }) },
                { value: '40', label: t('laila.minutes', { n: 40 }) },
                { value: '60', label: t('laila.minutes', { n: 60 }) },
              ]}
              onChange={(v) => set('lailaEyeMin', v === '20' ? 20 : v === '60' ? 60 : 40)}
            />
          </Row>
          <Row label={t('laila.waterEvery')}>
            <Segmented<'60' | '90'>
              label={t('laila.waterEvery')}
              value={settings.lailaWaterMin === 60 ? '60' : '90'}
              options={[
                { value: '60', label: t('laila.minutes', { n: 60 }) },
                { value: '90', label: t('laila.minutes', { n: 90 }) },
              ]}
              onChange={(v) => set('lailaWaterMin', v === '60' ? 60 : 90)}
            />
          </Row>
        </>
      )}
    </Group>
  );
}
