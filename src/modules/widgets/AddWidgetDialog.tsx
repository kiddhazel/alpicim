import { t } from '../../i18n';
import { Dialog } from '../../shared/ui/overlays';
import { List, ListItem } from '../../shared/ui/primitives';
import { WIDGETS } from './registry';
import type { WidgetType } from './types';

export function AddWidgetDialog({ onAdd, onClose }: { onAdd: (type: WidgetType) => void; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={t('widgets.add')} width={520}>
      <List className="max-h-[60vh] overflow-y-auto">
        {WIDGETS.map((def) => (
          <ListItem
            key={def.type}
            icon={def.icon}
            title={t(def.titleKey)}
            subtitle={t(def.descriptionKey)}
            onClick={() => onAdd(def.type)}
          />
        ))}
      </List>
    </Dialog>
  );
}
