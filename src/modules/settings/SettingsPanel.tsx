import { AppWindow, Info, Keyboard, KeyRound, LayoutGrid, LogOut, Monitor, Palette, PanelBottom, Puzzle, RefreshCw, Sparkles, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { settingsOf } from '../../core/modules/registry';
import { useModules } from '../../core/modules/useModules';
import { t, type MessageKey } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { Button, cx, Segmented, TextInput, Toggle } from '../../shared/ui/primitives';
import { IntegrationsSettings } from '../integrations/IntegrationsSettings';
import { windowService } from '../window-manager/windowService';
import { BarSettings } from './BarSettings';
import { ScreenSettings, ScreensaverSettings, ShortcutSettings, StartupSettings } from './DisplaySettings';
import { ModulesSettings } from './ModulesSettings';
import { LIMITS, useSettings, type ThemeMode } from './settings';
import { Group, Row, SectionTitleContext } from './SettingsLayout';
import { WorkspaceSettings } from './WorkspaceSettings';

/** Çekirdek bölüm kimlikleri; modüller kendi bölümlerini manifestlerinde bildirir (core/modules). */
type CoreSectionId =
  | 'appearance'
  | 'updates'
  | 'display'
  | 'bar'
  | 'workspaces'
  | 'shortcuts'
  | 'features'
  | 'windows'
  | 'providers'
  | 'modules'
  | 'about';

interface SectionDef {
  id: string;
  icon: LucideIcon;
  title: MessageKey;
  desc?: MessageKey;
}

const CORE_SECTIONS: (SectionDef & { id: CoreSectionId })[] = [
  { id: 'appearance', icon: Palette, title: 'settings.appearance', desc: 'redesign.sectionAppearance' },
  { id: 'updates', icon: RefreshCw, title: 'settings.updates', desc: 'redesign.sectionUpdates' },
  { id: 'display', icon: Monitor, title: 'display.title', desc: 'redesign.sectionDisplay' },
  { id: 'bar', icon: PanelBottom, title: 'bar.title', desc: 'redesign.sectionBar' },
  { id: 'workspaces', icon: LayoutGrid, title: 'workspaces.title', desc: 'redesign.sectionWorkspaces' },
  { id: 'shortcuts', icon: Keyboard, title: 'shortcuts.title', desc: 'redesign.sectionShortcuts' },
  { id: 'features', icon: Sparkles, title: 'settings.features', desc: 'redesign.sectionFeatures' },
  { id: 'windows', icon: AppWindow, title: 'settings.windows', desc: 'redesign.sectionWindows' },
  { id: 'providers', icon: KeyRound, title: 'settings.providers', desc: 'redesign.sectionProviders' },
  { id: 'modules', icon: Puzzle, title: 'modules.title', desc: 'modules.hint' },
  { id: 'about', icon: Info, title: 'settings.about', desc: 'redesign.sectionAbout' },
];

const MODULE_SECTION_COMPONENTS = new Map<string, ComponentType>();
function moduleSectionComponent(id: string, load: () => Promise<{ default: ComponentType }>): ComponentType {
  let c = MODULE_SECTION_COMPONENTS.get(id);
  if (!c) {
    c = lazy(load);
    MODULE_SECTION_COMPONENTS.set(id, c);
  }
  return c;
}

export function SettingsPanel() {
  const [settings, setSettings] = useSettings();
  const { active, isEnabled } = useModules();
  const [sectionId, setSection] = useState<string>('appearance');
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  // Etkin modüllerin ayar bölümleri, "Modüller" sayfasından sonra ve "Hakkında"dan önce.
  const moduleSections = useMemo(() => settingsOf(active), [active]);
  const sections = useMemo<SectionDef[]>(() => {
    const extra = moduleSections.map(({ section: c }) => ({ id: c.id, icon: c.icon, title: c.titleKey, desc: c.descriptionKey }));
    const aboutAt = CORE_SECTIONS.findIndex((x) => x.id === 'about');
    return [...CORE_SECTIONS.slice(0, aboutAt), ...extra, ...CORE_SECTIONS.slice(aboutAt)];
  }, [moduleSections]);
  const current = sections.find((s) => s.id === sectionId) ?? sections[0]!;
  const section = current.id;
  const extraSection = moduleSections.find(({ section: c }) => c.id === current.id)?.section;
  const ExtraBody = extraSection ? moduleSectionComponent(extraSection.id, extraSection.load) : null;

  return (
    <SectionTitleContext.Provider value={t(current.title)}>
    <div className="flex h-full gap-6">
      <nav aria-label={t('redesign.navLabel')} className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto pr-1">
        {sections.map((s) => {
          const active = s.id === section;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setSection(s.id)}
              className={cx(
                'relative flex h-9 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-150',
                active ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-2 hover:bg-card-hover hover:text-fg',
              )}
            >
              <s.icon size={18} strokeWidth={1.75} className={cx('shrink-0', active && 'text-accent')} />
              <span className="truncate">{t(s.title)}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-3xl pr-2 pb-6">
          <h2 className="font-display text-xl font-semibold">{t(current.title)}</h2>
          {current.desc && <p className="mt-1 mb-6 text-sm text-fg-2">{t(current.desc)}</p>}
          {!current.desc && <div className="mb-6" />}

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
              {isEnabled('screensaver') && <ScreensaverSettings />}
            </>
          )}
          {section === 'bar' && <BarSettings />}
          {section === 'workspaces' && <WorkspaceSettings />}
          {section === 'shortcuts' && <ShortcutSettings />}
          {section === 'modules' && (
            <ModulesSettings
              sectionOf={(id) => settingsOf(active).find((x) => x.module.id === id)?.section.id ?? null}
              onOpenSection={setSection}
            />
          )}
          {ExtraBody && (
            <Suspense fallback={null}>
              <ExtraBody />
            </Suspense>
          )}

          {section === 'features' && (
            <>
            <Group title={t('settings.features')}>
              <Row label={t('settings.performance')} hint={t('settings.performanceHint')}>
                <Toggle checked={settings.performanceMode} label={t('settings.performance')} onChange={(v) => set('performanceMode', v)} />
              </Row>
              <Row label={t('settings.gameModeAuto')} hint={t('settings.gameModeAutoHint')}>
                <Toggle checked={settings.gameModeAuto} label={t('settings.gameModeAuto')} onChange={(v) => set('gameModeAuto', v)} />
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
            </>
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
                  const target = sections.find((s) => s.id === id);
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
                <p className="mb-3 text-sm text-fg-2">{t('settings.aboutBody')}</p>
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
      <span className="text-sm text-fg-2">{suffix}</span>
    </span>
  );
}

