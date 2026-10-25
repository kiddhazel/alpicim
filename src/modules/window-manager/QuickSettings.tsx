import { MonitorUp, Settings2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { Button, Segmented, Toggle } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { displayService, type DisplayMode, type DisplaySnapshot } from '../display/displayService';
import { MonitorSelect } from '../display/MonitorSelect';
import { useSettings, type ThemeMode } from '../settings/settings';
import { PANELS, type PanelId } from './panels';

/** Hızlı ayarlar: tema, ekran modu/monitör, bu çalışma alanının panelleri ve performans modu. */
export function QuickSettings({
  display,
  onDisplay,
  docked,
  onTogglePanel,
  onOpenSettings,
  onClose,
  split,
  canSplit,
  onToggleSplit,
}: {
  split: boolean;
  canSplit: boolean;
  onToggleSplit: (on: boolean) => void;
  display: DisplaySnapshot;
  onDisplay: (s: DisplaySnapshot) => void;
  docked: PanelId[];
  onTogglePanel: (p: PanelId) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useSettings();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOverlay('quick-settings', true);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-quick-settings-toggle]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // pointerdown + yakalama: panel başlıkları sürükleme için preventDefault çağırdığında mousedown hiç oluşmuyor.
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      setOverlay('quick-settings', false);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const setDisplay = async (mode: DisplayMode, monitor: string | null) => {
    try {
      onDisplay(await displayService.set(mode, monitor));
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  return (
    <div ref={ref} role="dialog" aria-label={t('quick.title')} className="glass absolute top-11 right-0 z-40 w-96 rounded-3xl p-5 text-sm">
      <Section title={t('quick.layout')}>
        <div className="flex flex-col gap-2">
          <div className={canSplit || split ? 'flex items-center justify-between py-1' : 'flex items-center justify-between py-1 opacity-50'}>
            <div>
              <p className="text-sm font-medium">{t('stage.split')}</p>
              <p className="text-xs text-muted">{t('stage.splitHint')}</p>
            </div>
            <Toggle checked={split} label={t('stage.split')} onChange={(v) => (canSplit || !v) && onToggleSplit(v)} />
          </div>
        </div>
      </Section>
      <Section title={t('settings.theme')}>
        <Segmented<ThemeMode>
          label={t('settings.theme')}
          value={settings.theme}
          onChange={(v) => setSettings((s) => ({ ...s, theme: v }))}
          options={[
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'system', label: t('settings.themeSystem') },
          ]}
        />
      </Section>
      <Section title={t('display.title')}>
        <div className="flex flex-col gap-2">
          <Segmented<DisplayMode>
            label={t('display.mode')}
            value={display.prefs.mode}
            onChange={(m) => void setDisplay(m, display.prefs.monitor)}
            options={[
              { value: 'window', label: t('display.window') },
              { value: 'fullscreen', label: t('display.fullscreen') },
            ]}
          />
          <div className="flex gap-2">
            <MonitorSelect snapshot={display} onChange={(m) => void setDisplay(display.prefs.mode, m)} className="min-w-0 flex-1" />
            <Button
              icon={MonitorUp}
              onClick={() => displayService.moveToTarget().then(onDisplay).catch((err: unknown) => toast.push('error', describeError(err).description))}
              title={t('display.moveHere')}
            />
          </div>
        </div>
      </Section>
      <Section title={t('quick.panels')}>
        <div className="grid grid-cols-2 gap-1">
          {PANELS.map((p) => {
            const Icon = p.icon;
            const on = docked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => onTogglePanel(p.id)}
                className={on ? 'flex h-9 items-center gap-2 rounded-lg bg-accent-soft px-2.5 text-left text-sm text-accent' : 'flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-sm text-muted hover:bg-surface-3'}
              >
                <Icon size={16} />
                <span className="truncate">{t(p.titleKey)}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <div className="flex items-center justify-between py-1.5">
        <div>
          <p className="text-sm font-medium">{t('settings.performance')}</p>
          <p className="text-xs text-muted">{t('quick.performanceHint')}</p>
        </div>
        <Toggle checked={settings.performanceMode} label={t('settings.performance')} onChange={(v) => setSettings((s) => ({ ...s, performanceMode: v }))} />
      </div>
      <Button
        variant="ghost"
        icon={Settings2}
        className="mt-1 w-full justify-center"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
      >
        {t('quick.allSettings')}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h3>
      {children}
    </section>
  );
}
