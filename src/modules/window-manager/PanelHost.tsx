import { lazy, Suspense, type ComponentType } from 'react';
import { MODULES } from '../../core/modules';
import { moduleOfPanel, panelsOf } from '../../core/modules/registry';
import type { PanelComponentProps } from '../../core/modules/types';
import { useModuleEnabled } from '../../core/modules/useModules';
import { t } from '../../i18n';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { StateView } from '../../shared/ui/StateView';
import type { PanelId } from './panels';

// Paneller ayrı parçalar (chunk) olarak yalnızca ilk gösterildiklerinde yüklenir; yükleyiciler modül bildiriminden gelir.
const LAZY = new Map<PanelId, ComponentType<PanelComponentProps>>(panelsOf(MODULES).map((p) => [p.id, lazy(p.load)]));

/** Panel kimliğini içerik bileşenine eşler (modül bildiriminden). Kapalı modülün paneli gösterilmez. Hata veren panel diğerlerini etkilemez. */
export function PanelHost({ panel, onOpenPanel }: { panel: PanelId; onOpenPanel: (p: PanelId) => void }) {
  const moduleId = moduleOfPanel(MODULES, panel)?.id ?? '';
  const enabled = useModuleEnabled(moduleId);
  const Content = LAZY.get(panel);
  return (
    <ErrorBoundary resetKey={panel}>
      <Suspense fallback={<StateView kind="loading" title={t('common.loading')} />}>
        {enabled && Content ? <Content onOpenPanel={onOpenPanel} /> : <StateView kind="empty" title={t('modules.disabledTitle')} description={t('modules.disabledBody')} />}
      </Suspense>
    </ErrorBoundary>
  );
}
