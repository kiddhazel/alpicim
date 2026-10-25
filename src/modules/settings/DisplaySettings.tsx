import { Keyboard, MonitorUp, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { Button, cx, Segmented, Toggle } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import {
  displayService,
  formatAccelerator,
  useDisplay,
  type DisplayMode,
  type ShortcutAction,
  type ShortcutStatus,
} from '../display/displayService';
import { MonitorSelect } from '../display/MonitorSelect';
import { useSettings } from './settings';
import { Group, Row } from './SettingsLayout';

/** Ekran modu, hedef monitör ve başlangıç davranışı. */
export function DisplaySettings() {
  return (
    <>
      <ScreenSettings />
      <StartupSettings />
      <ShortcutSettings />
    </>
  );
}

/** Ekran modu ve hedef monitör. */
export function ScreenSettings() {
  const toast = useToast();
  const { snapshot, setSnapshot } = useDisplay();

  const apply = async (mode: DisplayMode, monitor: string | null) => {
    try {
      setSnapshot(await displayService.set(mode, monitor));
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  return (
      <Group title={t('display.title')}>
        <Row label={t('display.mode')} hint={t('display.modeHint')}>
          <Segmented<DisplayMode>
            label={t('display.mode')}
            value={snapshot.prefs.mode}
            onChange={(m) => void apply(m, snapshot.prefs.monitor)}
            options={[
              { value: 'window', label: t('display.window') },
              { value: 'fullscreen', label: t('display.fullscreen') },
            ]}
          />
        </Row>
        <Row label={t('display.monitor')} hint={t('display.monitorHint')}>
          <div className="flex gap-1">
            <MonitorSelect snapshot={snapshot} onChange={(m) => void apply(snapshot.prefs.mode, m)} />
            <Button
              icon={MonitorUp}
              disabled={!isTauri()}
              onClick={() => displayService.moveToTarget().then(setSnapshot).catch((err: unknown) => toast.push('error', describeError(err).description))}
            >
              {t('display.moveHere')}
            </Button>
          </div>
        </Row>
        {snapshot.monitors.length > 0 && (
          <div className="py-3.5">
            <MonitorMap snapshot={snapshot} />
          </div>
        )}
      </Group>
  );
}

/** Başlangıç davranışı. */
export function StartupSettings() {
  const toast = useToast();
  const [settings, setSettings] = useSettings();
  const [autostart, setAutostart] = useState<boolean | null>(null);

  useEffect(() => {
    if (isTauri()) displayService.getAutostart().then(setAutostart).catch(() => setAutostart(null));
  }, []);

  return (
      <Group title={t('startup.title')}>
        <Row label={t('startup.autostart')} hint={t('startup.autostartHint')}>
          <Toggle
            checked={autostart === true}
            label={t('startup.autostart')}
            onChange={(v) =>
              displayService
                .setAutostart(v)
                .then(() => setAutostart(v))
                .catch((err: unknown) => toast.push('error', describeError(err).description))
            }
          />
        </Row>
        <Row label={t('startup.hidden')} hint={t('startup.hiddenHint')}>
          <Toggle checked={settings.startHidden} label={t('startup.hidden')} onChange={(v) => setSettings((s) => ({ ...s, startHidden: v }))} />
        </Row>
      </Group>
  );
}

/** Monitörlerin küçük ölçekli yerleşim haritası (hangisi hedef, hangisinde açık). */
function MonitorMap({ snapshot }: { snapshot: ReturnType<typeof useDisplay>['snapshot'] }) {
  const ms = snapshot.monitors;
  const minX = Math.min(...ms.map((m) => m.x));
  const minY = Math.min(...ms.map((m) => m.y));
  const maxX = Math.max(...ms.map((m) => m.x + m.width));
  const maxY = Math.max(...ms.map((m) => m.y + m.height));
  const scale = Math.min(320 / (maxX - minX), 110 / (maxY - minY));
  return (
    <div className="relative mx-auto" style={{ width: (maxX - minX) * scale, height: (maxY - minY) * scale }} aria-hidden>
      {ms.map((m, i) => (
        <div
          key={m.id}
          className={cx(
            'absolute flex flex-col items-center justify-center rounded border text-xs',
            m.target ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface-3 text-muted',
          )}
          style={{ left: (m.x - minX) * scale + 2, top: (m.y - minY) * scale + 2, width: m.width * scale - 4, height: m.height * scale - 4 }}
        >
          <span className="font-semibold">{(/DISPLAY(\d+)/i.exec(m.id)?.[1] ?? String(i + 1))}</span>
          <span>{m.current ? t('display.current') : m.target ? t('display.targetShort') : ''}</span>
        </div>
      ))}
    </div>
  );
}

const ACTION_LABELS: Record<ShortcutAction, MessageKey> = {
  toggleVisible: 'shortcuts.toggleVisible',
  toggleFullscreen: 'shortcuts.toggleFullscreen',
  palette: 'shortcuts.palette',
};

export function ShortcutSettings() {
  const toast = useToast();
  const [list, setList] = useState<ShortcutStatus[]>([]);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (isTauri()) displayService.getShortcuts().then(setList).catch(() => {});
  }, []);

  const save = async (action: ShortcutAction, accelerator: string) => {
    const bindings = Object.fromEntries(list.map((s) => [s.action, s.action === action ? accelerator : s.accelerator]));
    try {
      setList(await displayService.setShortcuts(bindings));
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }
      const accel = formatAccelerator(e);
      if (!accel) return;
      setRecording(null);
      void save(recording, accel);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  return (
    <Group title={t('shortcuts.title')}>
      <p className="py-3 text-sm text-muted">{t('shortcuts.hint')}</p>
      {list.length === 0 && <p className="py-3 text-sm text-faint">{t('errors.desktopBody')}</p>}
      {list.map((s) => (
        <Row key={s.action} label={t(ACTION_LABELS[s.action])} hint={s.error ?? undefined}>
          <div className="flex items-center gap-1">
            <Button icon={Keyboard} onClick={() => setRecording(s.action)} className={cx('min-w-36 justify-center', s.error && 'border-warn text-warn')}>
              {recording === s.action ? t('shortcuts.press') : s.accelerator || t('shortcuts.off')}
            </Button>
            <Button variant="ghost" onClick={() => void save(s.action, '')} disabled={!s.accelerator}>
              {t('shortcuts.disable')}
            </Button>
            <Button variant="ghost" icon={RotateCcw} title={t('shortcuts.reset')} onClick={() => void save(s.action, s.defaultAccelerator)} />
          </div>
        </Row>
      ))}
      <p className="py-3 text-xs text-faint">{t('shortcuts.inApp')}</p>
    </Group>
  );
}
