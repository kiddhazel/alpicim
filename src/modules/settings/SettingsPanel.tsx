import { AppWindow, Info, Keyboard, KeyRound, LayoutGrid, LogOut, Monitor, Palette, PanelBottom, RefreshCw, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import type { Chattiness } from '../laila/brain';
import { Button, cx, Segmented, TextInput, Toggle } from '../../shared/ui/primitives';
import { AdblockSettings } from '../browser/AdblockSettings';
import { IntegrationsSettings } from '../integrations/IntegrationsSettings';
import { windowService } from '../window-manager/windowService';
import { BarSettings } from './BarSettings';
import { ScreenSettings, ShortcutSettings, StartupSettings } from './DisplaySettings';
import { LIMITS, useSettings, type ThemeMode } from './settings';
import { Group, Row, SectionTitleContext } from './SettingsLayout';
import { WorkspaceSettings } from './WorkspaceSettings';

type SectionId =
  | 'appearance'
  | 'updates'
  | 'display'
  | 'bar'
  | 'workspaces'
  | 'shortcuts'
  | 'features'
  | 'adblock'
  | 'windows'
  | 'providers'
  | 'about';

const SECTIONS: { id: SectionId; icon: LucideIcon; title: MessageKey; desc: MessageKey }[] = [
  { id: 'appearance', icon: Palette, title: 'settings.appearance', desc: 'redesign.sectionAppearance' },
  { id: 'updates', icon: RefreshCw, title: 'settings.updates', desc: 'redesign.sectionUpdates' },
  { id: 'display', icon: Monitor, title: 'display.title', desc: 'redesign.sectionDisplay' },
  { id: 'bar', icon: PanelBottom, title: 'bar.title', desc: 'redesign.sectionBar' },
  { id: 'workspaces', icon: LayoutGrid, title: 'workspaces.title', desc: 'redesign.sectionWorkspaces' },
  { id: 'shortcuts', icon: Keyboard, title: 'shortcuts.title', desc: 'redesign.sectionShortcuts' },
  { id: 'features', icon: Sparkles, title: 'settings.features', desc: 'redesign.sectionFeatures' },
  { id: 'adblock', icon: ShieldCheck, title: 'adblock.title', desc: 'redesign.sectionAdblock' },
  { id: 'windows', icon: AppWindow, title: 'settings.windows', desc: 'redesign.sectionWindows' },
  { id: 'providers', icon: KeyRound, title: 'settings.providers', desc: 'redesign.sectionProviders' },
  { id: 'about', icon: Info, title: 'settings.about', desc: 'redesign.sectionAbout' },
];

export function SettingsPanel() {
  const [settings, setSettings] = useSettings();
  const [section, setSection] = useState<SectionId>('appearance');
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;

  return (
    <SectionTitleContext.Provider value={t(current.title)}>
    <div className="flex h-full gap-4 p-4">
      <nav aria-label={t('redesign.navLabel')} className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface-2 p-2">
        {SECTIONS.map((s) => {
          const active = s.id === section;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setSection(s.id)}
              className={cx(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-left text-base transition-colors',
                active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              <s.icon size={18} className="shrink-0" />
              <span className="truncate">{t(s.title)}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-3xl px-2 pb-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t(current.title)}</h2>
          <p className="mt-1 mb-6 text-sm text-muted">{t(current.desc)}</p>

          {section === 'appearance' && (
            <Group title={t('settings.appearance')}>
              <Row label={t('settings.theme')}>
                <Segmented<ThemeMode>
                  label={t('settings.theme')}
                  value={settings.theme}
                  onChange={(v) => set('theme', v)}
                  options={[
                    { value: 'dark', label: t('settings.themeDark') },
                    { value: 'light', label: t('settings.themeLight') },
                    { value: 'system', label: t('settings.themeSystem') },
                  ]}
                />
              </Row>
            </Group>
          )}

          {section === 'updates' && (
            <Group title={t('settings.updates')}>
              <Row label={t('settings.newsInterval')} hint={t('settings.newsIntervalHint')}>
                <NumberField
                  value={settings.newsRefreshMinutes}
                  min={LIMITS.newsRefreshMinutes.min}
                  max={LIMITS.newsRefreshMinutes.max}
                  suffix={t('settings.minutes')}
                  onChange={(v) => set('newsRefreshMinutes', v)}
                />
              </Row>
              <Row label={t('settings.marketsInterval')} hint={t('settings.marketsIntervalHint')}>
                <NumberField
                  value={settings.marketsRefreshSeconds}
                  min={LIMITS.marketsRefreshSeconds.min}
                  max={LIMITS.marketsRefreshSeconds.max}
                  suffix={t('settings.seconds')}
                  onChange={(v) => set('marketsRefreshSeconds', v)}
                />
              </Row>
            </Group>
          )}

          {section === 'display' && (
            <>
              <ScreenSettings />
              <StartupSettings />
            </>
          )}
          {section === 'bar' && <BarSettings />}
          {section === 'workspaces' && <WorkspaceSettings />}
          {section === 'shortcuts' && <ShortcutSettings />}
          {section === 'adblock' && <AdblockSettings />}

          {section === 'features' && (
            <Group title={t('settings.features')}>
              <Row label={t('settings.performance')} hint={t('settings.performanceHint')}>
                <Toggle checked={settings.performanceMode} label={t('settings.performance')} onChange={(v) => set('performanceMode', v)} />
              </Row>
              <Row label={t('settings.musicKeepPlaying')} hint={t('settings.musicKeepPlayingHint')}>
                <Toggle checked={settings.musicKeepPlaying} label={t('settings.musicKeepPlaying')} onChange={(v) => set('musicKeepPlaying', v)} />
              </Row>
              <Row label={t('settings.embed')} hint={t('settings.embedHint')}>
                <Toggle checked={settings.embedEnabled} label={t('settings.embed')} onChange={(v) => set('embedEnabled', v)} />
              </Row>
              <Row label={t('settings.focusExisting')} hint={t('settings.focusExistingHint')}>
                <Toggle checked={settings.launcherFocusExisting} label={t('settings.focusExisting')} onChange={(v) => set('launcherFocusExisting', v)} />
              </Row>
            </Group>
          )}

          {section === 'features' && (
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
            </Group>
          )}

          {section === 'windows' && (
            <Group title={t('settings.windows')}>
              <Row label={t('settings.closeToTray')} hint={t('settings.closeToTrayHint')}>
                <Toggle checked={settings.closeToTray} label={t('settings.closeToTray')} onChange={(v) => set('closeToTray', v)} />
              </Row>
            </Group>
          )}

          {section === 'providers' && (
            <>
              <IntegrationsSettings
                onOpenSection={(id) => {
                  const target = SECTIONS.find((s) => s.id === id);
                  if (target) setSection(target.id);
                }}
              />
              <Group title={t('markets.demoTitle')}>
                <Row label={t('settings.demo')} hint={t('settings.demoHint')}>
                  <Toggle checked={settings.showDemoData} label={t('settings.demo')} onChange={(v) => set('showDemoData', v)} />
                </Row>
              </Group>
            </>
          )}

          {section === 'about' && (
            <Group title={t('settings.about')}>
              <div className="py-4">
                <p className="mb-3 text-sm text-muted">{t('settings.aboutBody')}</p>
                <Button variant="danger" icon={LogOut} onClick={() => void windowService.quitApp().catch(() => {})} disabled={!isTauri()}>
                  {t('settings.quit')}
                </Button>
              </div>
            </Group>
          )}
        </div>
      </div>
    </div>
    </SectionTitleContext.Provider>
  );
}

function NumberField({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
    else setDraft(String(value));
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <TextInput
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="tabular w-20 text-right"
        aria-label={suffix}
      />
      <span className="text-sm text-muted">{suffix}</span>
    </span>
  );
}

