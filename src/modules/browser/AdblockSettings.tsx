import { Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { formatRelative } from '../../shared/lib/time';
import { Badge, Button, IconButton, TextInput, Toggle } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { Group, Row } from '../settings/SettingsLayout';
import { useAdblock } from './useAdblock';

const fmt = (n: number) => n.toLocaleString('tr-TR');

/** Ayarlar → Reklam engelleyici: aç/kapat, filtre listeleri, izin verilen siteler. */
export function AdblockSettings() {
  const toast = useToast();
  const { desktop, status, loadError, busy, setEnabled, updateLists, allowSite, removeSite } = useAdblock();
  const [host, setHost] = useState('');

  const attempt = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) toast.push('success', success);
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  if (!desktop) {
    return (
      <Group title={t('adblock.title')}>
        <p className="py-4 text-sm text-fg-2">{t('adblock.desktopOnly')}</p>
      </Group>
    );
  }

  if (!status) {
    return (
      <Group title={t('adblock.title')}>
        <p className="py-4 text-sm text-fg-2">{loadError ? describeError(loadError).description : t('adblock.loading')}</p>
      </Group>
    );
  }

  const updating = status.updating || busy === 'update';
  const summary = status.ready
    ? t('adblock.rules', { n: fmt(status.rules) })
    : updating
      ? t('adblock.downloading')
      : t('adblock.notReady');

  return (
    <>
      <Group title={t('adblock.title')}>
        <Row label={t('adblock.enabled')} hint={t('adblock.enabledHint')}>
          <Toggle
            checked={status.enabled}
            label={t('adblock.enabled')}
            onChange={(v) => void attempt(() => setEnabled(v))}
          />
        </Row>
        <Row label={t('adblock.status')} hint={summary}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.enabled && status.ready ? 'up' : 'neutral'}>
              <ShieldCheck size={13} />
              {t('adblock.blockedTotal', { n: fmt(status.blockedTotal) })}
            </Badge>
            <Button
              icon={RefreshCw}
              disabled={updating}
              onClick={() => void attempt(async () => {
                const next = await updateLists();
                if (next.error) throw new Error(next.error);
              }, t('adblock.updated'))}
            >
              {updating ? t('adblock.updating') : t('adblock.update')}
            </Button>
          </div>
        </Row>
        {status.error && <p className="py-3 text-sm text-warn">{status.error}</p>}
        <div className="py-4">
          <p className="mb-2 text-base font-medium">{t('adblock.lists')}</p>
          <ul className="flex flex-col gap-1.5">
            {status.lists.map((list) => (
              <li key={list.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="truncate">{list.title}</span>
                <span className="tabular text-xs text-fg-3">
                  {list.updatedAt
                    ? t('adblock.listMeta', { n: fmt(list.rules), when: formatRelative(list.updatedAt) })
                    : t('adblock.listMissing')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-3">{t('adblock.listsHint')}</p>
        </div>
      </Group>

      <Group title={t('adblock.allowlist')}>
        <div className="py-4">
          <p className="mb-2 text-sm text-fg-2">{t('adblock.allowlistHint')}</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void attempt(async () => {
                await allowSite(host);
                setHost('');
              });
            }}
          >
            <TextInput
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={t('adblock.allowPlaceholder')}
              aria-label={t('adblock.allowPlaceholder')}
              spellCheck={false}
              className="min-w-48 flex-1"
            />
            <Button type="submit" icon={Plus} disabled={busy === 'site' || !host.trim()}>
              {t('adblock.allowAdd')}
            </Button>
          </form>
          {status.allowlist.length === 0 ? (
            <p className="mt-3 text-sm text-fg-3">{t('adblock.allowEmpty')}</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-stroke">
              {status.allowlist.map((h) => (
                <li key={h} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-sm">{h}</span>
                  <IconButton
                    icon={Trash2}
                    size="sm"
                    tone="danger"
                    label={t('adblock.allowRemove', { host: h })}
                    disabled={busy === 'site'}
                    onClick={() => void attempt(() => removeSite(h))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Group>
    </>
  );
}
