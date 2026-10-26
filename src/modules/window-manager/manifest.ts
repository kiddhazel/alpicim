import { LayoutDashboard } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';

/** Ana ekran (widget ızgarası) — zorunlu. Temel widget'lar burada. */
export const homeModule: ModuleManifest = {
  id: 'home',
  titleKey: 'modules.items.home.title',
  descriptionKey: 'modules.items.home.description',
  icon: LayoutDashboard,
  category: 'core',
  defaultEnabled: true,
  required: true,
  panels: [
    {
      id: 'home',
      titleKey: 'panels.home',
      icon: LayoutDashboard,
      load: () => import('../widgets/WidgetBoard').then((m) => ({ default: (p) => createElement(m.WidgetBoard, { onOpenPanel: p.onOpenPanel }) })),
    },
  ],
  widgets: ['clock', 'calendar', 'links', 'pomodoro', 'todo', 'notes', 'favorites'],
  integrations: ['ics'],
};
