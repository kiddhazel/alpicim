import { openUrl } from '@tauri-apps/plugin-opener';
import { ArrowRight, ExternalLink, FlaskConical, KeyRound, Loader2, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { Badge, Button, TextInput, Toggle, type BadgeTone } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Group } from '../settings/SettingsLayout';
import { ICS_URL_KEY, sanitizeIcsUrl, saveIcsUrl } from '../widgets/basic/icsService';
import { canTestIntegration, testIntegration } from './integrationTests';
import { clearIntegrationKey, saveIntegrationKey } from './integrationsService';
import { groupByCategory, isUsable, type IntegrationDef, type IntegrationStatus } from './registry';
import { useIntegrations } from './useIntegrations';

const STATUS_TONE: Record<IntegrationStatus, BadgeTone> = {
  keyless: 'accent',
  keyStored: 'up',
  keyRequired: 'warn',
  off: 'neutral',
};

function openExternal(url: string) {
  void (isTauri() ? openUrl(url) : Promise.resolve(window.open(url, '_blank', 'noopener')));
}

/** Ayarlar → Entegrasyonlar: kategoriye göre gruplu tüm dış hizmetler. */
export function IntegrationsSettings({ onOpenSection }: { onOpenSection: (section: string) => void }) {
  const integrations = useIntegrations();
  return (
    <>
      <p className="mb-6 max-w-2xl text-sm text-fg-2">{t('integrations.intro')}</p>
      {groupByCategory().map(([category, defs]) => (
        <Group key={category} title={t(`integrations.category.${category}`)}>
          {defs.map((def) => (
            <IntegrationRow
              key={def.id}
              def={def}
              enabled={integrations.states[def.id]}
              status={integrations.status(def.id)}
              hasKey={integrations.keys?.[def.id] ?? null}
              onToggle={(v) => integrations.setEnabled(def.id, v)}
              onOpenSection={onOpenSection}
            />
          ))}
        </Group>
      ))}
    </>
  );
}

function IntegrationRow({
  def,
  enabled,
  status,
  hasKey,
  onToggle,
  onOpenSection,
}: {
  def: IntegrationDef;
  enabled: boolean;
  status: IntegrationStatus | null;
  hasKey: boolean | null;
  onToggle: (v: boolean) => void;
  onOpenSection: (section: string) => void;
}) {
  const toast = useToast();
  const name = t(def.name);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    try {
      await testIntegration(def.id);
      toast.push('success', t('integrations.testOk', { name }));
    } catch (err) {
      toast.push('error', t('integrations.testFailed', { name, reason: describeError(err).description }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-medium">{name}</p>
            {def.control === 'toggle' && status && <Badge tone={STATUS_TONE[status]}>{t(`integrations.status.${status}`)}</Badge>}
            {def.control !== 'toggle' && !def.key && <Badge tone="accent">{t('integrations.status.keyless')}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-fg-2">{t(def.description)}</p>
          <p className="mt-1 text-xs text-fg-3">{t('integrations.powers', { list: t(def.powers) })}</p>
        </div>
        {def.control === 'toggle' && (
          <Toggle checked={enabled} label={t('integrations.enable', { name })} onChange={onToggle} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {def.key && (
          <button
            type="button"
            onClick={() => def.key && openExternal(def.key.signupUrl)}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            <KeyRound size={14} /> {t('integrations.getKey')} <ExternalLink size={13} />
          </button>
        )}
        <button type="button" onClick={() => openExternal(def.homepage)} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg hover:underline">
          {t('integrations.website')} <ExternalLink size={13} />
        </button>
        {def.control === 'settings' && def.settingsSection && (
          <button
            type="button"
            onClick={() => def.settingsSection && onOpenSection(def.settingsSection)}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            {t('integrations.openSettings')} <ArrowRight size={14} />
          </button>
        )}
        {def.control === 'toggle' && canTestIntegration(def.id) && isUsable(status) && (
          <button
            type="button"
            disabled={testing}
            onClick={() => void runTest()}
            className="inline-flex items-center gap-1 text-fg-2 hover:text-fg hover:underline disabled:opacity-60"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            {testing ? t('integrations.testing') : t('integrations.test')}
          </button>
        )}
      </div>

      {def.control === 'settings' && <p className="mt-1 text-xs text-fg-3">{t('integrations.managedElsewhere')}</p>}
      {def.control === 'info' && <p className="mt-1 text-xs text-fg-3">{t('integrations.infoOnly')}</p>}
      {def.key && enabled && <KeyEditor def={def} name={name} hasKey={hasKey} />}
      {def.id === 'ics' && enabled && <IcsUrlEditor />}
    </div>
  );
}

/** Takvim aboneliği adresi: yalnızca https; uygulama deposunda saklanır (depoya/koda yazılmaz). */
function IcsUrlEditor() {
  const toast = useToast();
  const [saved, setSaved] = usePersistentState<string>(ICS_URL_KEY, '', sanitizeIcsUrl);
  const [value, setValue] = useState('');
  const desktop = isTauri();

  const save = async () => {
    try {
      const url = await saveIcsUrl(value);
      setValue('');
      toast.push(url ? 'success' : 'info', t(url ? 'integrations.ics.saved' : 'integrations.ics.cleared'));
    } catch {
      toast.push('error', t('integrations.ics.invalid'));
    }
  };

  return (
    <div className="mt-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextInput
          type="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={saved ? t('integrations.keyReplacePlaceholder') : t('integrations.ics.placeholder')}
          aria-label={t('integrations.ics.label')}
          className="min-w-48 flex-1"
          disabled={!desktop}
        />
        <Button type="submit" variant="primary" icon={Save} disabled={!value.trim() || !desktop}>
          {t('common.save')}
        </Button>
        {saved && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              setSaved('');
              void saveIcsUrl('');
              toast.push('info', t('integrations.ics.cleared'));
            }}
          >
            {t('common.remove')}
          </Button>
        )}
      </form>
      {saved && <p className="selectable mt-1 truncate text-xs text-fg-3">{saved.replace(/\?.*$/, '?…')}</p>}
    </div>
  );
}

function KeyEditor({ def, name, hasKey }: { def: IntegrationDef; name: string; hasKey: boolean | null }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const desktop = isTauri();

  const save = async () => {
    setBusy(true);
    try {
      await saveIntegrationKey(def.id, value);
      setValue('');
      toast.push('success', t('integrations.keySaved', { name }));
    } catch (err) {
      toast.push('error', describeError(err).description);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await clearIntegrationKey(def.id);
      toast.push('info', t('integrations.keyCleared', { name }));
    } catch (err) {
      toast.push('error', describeError(err).description);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextInput
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasKey ? t('integrations.keyReplacePlaceholder') : t('integrations.keyPlaceholder', { name })}
          aria-label={t('integrations.keyPlaceholder', { name })}
          className="min-w-48 flex-1"
          disabled={!desktop}
        />
        <Button type="submit" variant="primary" icon={Save} disabled={busy || !value.trim() || !desktop}>
          {t('common.save')}
        </Button>
        {hasKey && (
          <Button variant="danger" icon={Trash2} onClick={() => void clear()} disabled={busy}>
            {t('common.remove')}
          </Button>
        )}
      </form>
      <p className="mt-2 text-xs text-fg-3">{desktop ? t('settings.keyHelp') : t('integrations.desktopOnly')}</p>
    </div>
  );
}
