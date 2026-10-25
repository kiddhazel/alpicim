import { AppWindow, Focus, PictureInPicture2, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { Badge, Button, IconButton, TextInput } from '../../shared/ui/primitives';
import { describeError, SkeletonRows, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { embedService, type WindowInfo } from './embedService';

/** Açık pencereler listesi: başlık + uygulama adı; gömülemeyenler nedeniyle birlikte gösterilir. */
export function WindowPicker({
  embedEnabled,
  onClose,
  onChoose,
}: {
  embedEnabled: boolean;
  onClose: () => void;
  onChoose: (w: WindowInfo, asCard: boolean) => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<WindowInfo[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');

  // Yerel yüzeyler (tarayıcı, gömülü pencereler) bu katmanın üstünde çizileceği için gizlenir.
  useEffect(() => {
    setOverlay('window-picker', true);
    return () => setOverlay('window-picker', false);
  }, []);

  const load = useCallback(() => {
    setError(null);
    embedService.list().then(setList).catch(setError);
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr-TR');
    if (!list) return [];
    return list.filter((w) => !needle || `${w.title} ${w.processName}`.toLocaleLowerCase('tr-TR').includes(needle));
  }, [list, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6 backdrop-blur-sm pt-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t('apps.pickerTitle')}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <PictureInPicture2 size={18} className="text-accent" />
          <h2 className="flex-1 text-md font-semibold">{t('apps.pickerTitle')}</h2>
          <IconButton icon={RefreshCw} label={t('news.refresh')} onClick={load} />
          <IconButton icon={X} label={t('common.close')} onClick={onClose} />
        </div>
        <div className="border-b border-line px-4 pb-3">
          <p className="mb-2 text-sm text-muted">{t('apps.pickerHint')}</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('apps.searchPlaceholder')} className="h-9 w-full pl-9 text-sm" autoFocus />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <StateView kind="error" title={t('apps.listFailed')} description={describeError(error).description} compact />
          ) : !list ? (
            <SkeletonRows rows={5} />
          ) : filtered.length === 0 ? (
            <StateView kind="empty" title={t('apps.noWindows')} compact />
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((w) => (
                <li key={w.hwnd} className="flex items-center gap-3 px-4 py-3">
                  <AppWindow size={18} className={w.embeddable ? 'text-accent' : 'text-faint'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium" title={w.title}>
                      {w.title}
                    </p>
                    <p className="truncate text-xs text-muted" title={w.exePath}>
                      {w.processName || '?'}
                      {w.reason && <span className="text-warn"> · {w.reason}</span>}
                    </p>
                  </div>
                  {!w.embeddable && <Badge tone="warn">{t('apps.unsupported')}</Badge>}
                  <IconButton
                    icon={Focus}
                    label={t('apps.bringToFront')}
                    onClick={() => embedService.activate(w.hwnd).catch((err: unknown) => toast.push('error', describeError(err).description))}
                  />
                  <Button onClick={() => onChoose(w, true)}>{t('apps.addCard')}</Button>
                  <Button variant="primary" disabled={!w.embeddable || !embedEnabled} onClick={() => onChoose(w, false)}>
                    {t('apps.embed')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-faint">{t('apps.warning')}</p>
      </div>
    </div>
  );
}
