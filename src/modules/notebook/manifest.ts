import { NotebookPen } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';
import { t } from '../../i18n';
import { requestNotebook } from './notebookService';

export const notesModule: ModuleManifest = {
  id: 'notes',
  titleKey: 'modules.items.notes.title',
  descriptionKey: 'modules.items.notes.description',
  icon: NotebookPen,
  category: 'work',
  defaultEnabled: true,
  panels: [
    {
      id: 'notes',
      titleKey: 'panels.notes',
      icon: NotebookPen,
      load: () => import('./NotesPanel').then((m) => ({ default: (p) => createElement(m.NotesPanel, { onOpenPanel: p.onOpenPanel }) })),
    },
  ],
  widgets: ['quicknote'],
  commands: (ctx) => [
    {
      id: 'act:newnote',
      group: 'note',
      title: t('palette.newNote'),
      subtitle: t('palette.newNoteHint'),
      keywords: 'not ekle yaz',
      run: () => {
        void requestNotebook({ action: 'new' });
        ctx.openPanel('notes');
      },
    },
  ],
};
