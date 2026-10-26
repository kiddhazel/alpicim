import { ClipboardList } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';

export const clipboardModule: ModuleManifest = {
  id: 'clipboard',
  titleKey: 'modules.items.clipboard.title',
  descriptionKey: 'modules.items.clipboard.description',
  icon: ClipboardList,
  category: 'work',
  defaultEnabled: true,
  panels: [{ id: 'clipboard', titleKey: 'panels.clipboard', icon: ClipboardList, load: () => import('./ClipboardPanel').then((m) => ({ default: (p) => createElement(m.ClipboardPanel, { onOpenPanel: p.onOpenPanel }) })) }],
};
