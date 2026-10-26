import { Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { Button, IconButton, Select, TextInput } from '../../shared/ui/primitives';
import { WORKSPACE_ICONS } from '../window-manager/StatusItems';
import {
  createWorkspace,
  removeWorkspace,
  resetActive,
  useWorkspaces,
  type WorkspaceIcon,
} from '../workspaces/workspaces';
import { Group, Row } from './SettingsLayout';

/** Çalışma alanları: oluştur (etkin olanın kopyası), yeniden adlandır, sil, varsayılana dön, açılış seçimi. */
export function WorkspaceSettings() {
  const [store, setStore] = useWorkspaces();
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Group title={t('workspaces.title')}>
      <Row label={t('workspaces.startup')} hint={t('workspaces.startupHint')}>
        <Select value={store.startup} onChange={(e) => setStore((s) => ({ ...s, startup: e.target.value }))} aria-label={t('workspaces.startup')}>
          <option value="last">{t('workspaces.last')}</option>
          {store.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Row>
      <ul className="py-1">
        {store.items.map((w) => {
          const Icon = WORKSPACE_ICONS[w.icon];
          const editing = editId === w.id;
          return (
            <li key={w.id} className="flex items-center gap-2 py-1.5">
              <Icon size={15} className={w.id === store.activeId ? 'text-accent' : 'text-fg-2'} />
              {editing ? (
                <form
                  className="flex flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStore((s) => ({
                      ...s,
                      items: s.items.map((x) => (x.id === w.id ? { ...x, name: name.trim().slice(0, 40) || x.name } : x)),
                    }));
                    setEditId(null);
                  }}
                >
                  <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-9 min-w-0 flex-1" maxLength={40} />
                  <Select
                    value={w.icon}
                    aria-label={t('workspaces.icon')}
                    onChange={(e) =>
                      setStore((s) => ({ ...s, items: s.items.map((x) => (x.id === w.id ? { ...x, icon: e.target.value as WorkspaceIcon } : x)) }))
                    }
                    className="h-9"
                  >
                    {Object.keys(WORKSPACE_ICONS).map((k) => (
                      <option key={k} value={k}>
                        {t(`workspaces.icons.${k as WorkspaceIcon}`)}
                      </option>
                    ))}
                  </Select>
                  <IconButton icon={Check} label={t('common.save')} type="submit" />
                </form>
              ) : (
                <>
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-base" onClick={() => setStore((s) => ({ ...s, activeId: w.id }))}>
                    {w.name}
                    {w.id === store.activeId && <span className="text-xs text-accent"> · {t('palette.active')}</span>}
                  </button>
                  <span className="text-xs text-fg-3">{t('workspaces.summary', { panels: w.layout.docked.length, widgets: w.widgets.length })}</span>
                  <IconButton
                    size="sm"
                    icon={Pencil}
                    label={t('workspaces.rename')}
                    onClick={() => {
                      setEditId(w.id);
                      setName(w.name);
                    }}
                  />
                  <IconButton
                    size="sm"
                    tone="danger"
                    icon={Trash2}
                    label={t('common.remove')}
                    disabled={store.items.length <= 1}
                    onClick={() => setStore((s) => removeWorkspace(s, w.id))}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 py-3.5">
        <Button icon={Copy} onClick={() => setStore((s) => createWorkspace(s, t('workspaces.newName')))}>
          {t('workspaces.duplicate')}
        </Button>
        {confirmReset ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                setStore((s) => resetActive(s));
                setConfirmReset(false);
              }}
            >
              {t('workspaces.resetConfirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
            {t('workspaces.reset')}
          </Button>
        )}
      </div>
    </Group>
  );
}
