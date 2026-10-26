import { AlertTriangle, AppWindow, Crosshair, Focus, PictureInPicture2, Plus, RefreshCw, SquareArrowOutUpRight, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { t } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { Badge, Button, cx, IconButton } from '../../shared/ui/primitives';
import { StateView } from '../../shared/ui/StateView';
import { useSettings } from '../settings/settings';
import { appName, type AppTab } from './embedService';
import { useEmbeddedApps } from './useEmbeddedApps';
import { WindowPicker } from './WindowPicker';

/**
 * Açık Windows uygulamalarını bu panele yerleştirir (deneysel). Her sekme bir uygulama penceresidir;
 * yalnızca etkin sekme görünür. Gömülemeyen uygulamalar "kart" olarak eklenir (öne getir düğmesiyle).
 */
export function AppsPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [settings] = useSettings();
  const contentRef = useRef<HTMLDivElement>(null);
  const apps = useEmbeddedApps(contentRef, settings.embedEnabled);
  const [picking, setPicking] = useState(false);

  if (!isTauri()) {
    return <StateView kind="desktop" title={t('errors.desktopTitle')} description={t('errors.desktopBody')} />;
  }

  const active = apps.active;
  const activeMissing = active ? apps.missing.includes(active.id) : false;
  const activeAttached = active?.hwnd != null && apps.attached.includes(active.hwnd);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-3 py-2">
        <div role="tablist" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {apps.tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              selected={active?.id === tab.id}
              missing={apps.missing.includes(tab.id)}
              onSelect={() => apps.setActiveId(tab.id)}
            />
          ))}
        </div>
        {active && (
          <>
            {active.mode === 'card' ? <Badge>{t('apps.cardBadge')}</Badge> : <Badge tone="accent">{t('apps.embeddedBadge')}</Badge>}
            <IconButton icon={Focus} label={t('apps.focus')} onClick={() => apps.focus(active)} disabled={active.hwnd === null || activeMissing} />
            <IconButton icon={SquareArrowOutUpRight} label={t('apps.detach')} onClick={() => void apps.detach(active)} />
          </>
        )}
        <Button icon={Plus} onClick={() => setPicking(true)} disabled={apps.busy}>
          {t('apps.add')}
        </Button>
        <IconButton icon={Crosshair} label={t('apps.pick')} onClick={() => void apps.pick()} disabled={apps.busy || !settings.embedEnabled} />
      </div>

      {!settings.embedEnabled && (
        <div className="flex shrink-0 items-center gap-2 bg-warn/10 px-4 py-2 text-sm text-warn">
          <AlertTriangle size={15} />
          <span className="flex-1">{t('apps.disabledBanner')}</span>
          <button type="button" className="underline" onClick={onOpenSettings}>
            {t('panels.settings')}
          </button>
        </div>
      )}
      {apps.busy && (
        <div className="shrink-0 bg-accent-soft px-4 py-2 text-sm text-accent">{t('apps.pickHint')}</div>
      )}

      {/* Gömülü pencere bu alanın üstüne yerleştirilir. */}
      <div ref={contentRef} className="relative min-h-0 flex-1 bg-card">
        {apps.tabs.length === 0 ? (
          <StateView
            kind="empty"
            title={t('apps.emptyTitle')}
            description={t('apps.emptyBody')}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setPicking(true)}>
                {t('apps.add')}
              </Button>
            }
          />
        ) : active && (active.mode === 'card' || activeMissing || !activeAttached) ? (
          <AppCard
            tab={active}
            missing={activeMissing}
            idle={apps.idle.includes(active.id) && settings.embedEnabled}
            onReattach={() => void apps.reattach(active)}
            onFocus={() => apps.focus(active)}
            onRelocate={() => void apps.relocate(active)}
            onRemove={() => void apps.detach(active)}
          />
        ) : (
          <p className="p-4 text-sm text-fg-3">{t('apps.hiddenWhileMenu')}</p>
        )}
      </div>

      {picking && (
        <WindowPicker
          embedEnabled={settings.embedEnabled}
          onClose={() => setPicking(false)}
          onChoose={(w, asCard) => {
            setPicking(false);
            void apps.add(w, asCard);
          }}
        />
      )}
    </div>
  );
}

function TabButton({ tab, selected, missing, onSelect }: { tab: AppTab; selected: boolean; missing: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      title={tab.title}
      className={cx(
        'flex h-9 max-w-48 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors',
        selected ? 'bg-control text-fg' : 'text-fg-2 hover:bg-control hover:text-fg',
        missing && 'opacity-60',
      )}
    >
      <AppWindow size={15} className={missing ? 'text-warn' : 'text-accent'} />
      <span className="truncate">{appName(tab)}</span>
    </button>
  );
}

function AppCard({
  tab,
  missing,
  idle,
  onReattach,
  onFocus,
  onRelocate,
  onRemove,
}: {
  tab: AppTab;
  missing: boolean;
  idle: boolean;
  onReattach: () => void;
  onFocus: () => void;
  onRelocate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <AppWindow size={32} strokeWidth={1.5} className="text-accent" />
      <div>
        <p className="text-lg font-semibold">{appName(tab)}</p>
        <p className="max-w-md truncate text-sm text-fg-2">{tab.title}</p>
      </div>
      <p className="max-w-md text-sm text-fg-2">
        {missing ? t('apps.missingBody') : idle ? t('apps.idleBody') : tab.mode === 'card' ? t('apps.cardBody') : t('common.loading')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {idle && !missing && (
          <Button variant="primary" icon={PictureInPicture2} onClick={onReattach}>
            {t('apps.reattach')}
          </Button>
        )}
        {!missing && (
          <Button variant="primary" icon={Focus} onClick={onFocus}>
            {t('apps.bringToFront')}
          </Button>
        )}
        {missing && (
          <Button variant="primary" icon={RefreshCw} onClick={onRelocate}>
            {t('apps.relocate')}
          </Button>
        )}
        <Button icon={X} onClick={onRemove}>
          {t('apps.removeTab')}
        </Button>
      </div>
    </div>
  );
}
