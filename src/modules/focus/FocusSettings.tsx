import { t } from '../../i18n';
import { Toggle } from '../../shared/ui/primitives';
import { Group, Row } from '../settings/SettingsLayout';
import { setManual } from './focus';
import { useFocus } from './useFocus';

/** Ayarlar → Odak modu grubu. */
export function FocusSettings() {
  const { focus, setFocus } = useFocus();
  return (
    <Group title={t('focus.title')}>
      <Row label={t('focus.enable')} hint={t('focus.enableHint')}>
        <Toggle checked={focus.on} label={t('focus.enable')} onChange={(v) => setFocus((s) => setManual(s, v))} />
      </Row>
      <Row label={t('focus.autoPomodoro')} hint={t('focus.autoPomodoroHint')}>
        <Toggle checked={focus.autoPomodoro} label={t('focus.autoPomodoro')} onChange={(v) => setFocus((s) => ({ ...s, autoPomodoro: v }))} />
      </Row>
      <Row label={t('focus.suppressToasts')} hint={t('focus.suppressToastsHint')}>
        <Toggle checked={focus.suppressToasts} label={t('focus.suppressToasts')} onChange={(v) => setFocus((s) => ({ ...s, suppressToasts: v }))} />
      </Row>
      <Row label={t('focus.dim')} hint={t('focus.dimHint')}>
        <Toggle checked={focus.dim} label={t('focus.dim')} onChange={(v) => setFocus((s) => ({ ...s, dim: v }))} />
      </Row>
    </Group>
  );
}
