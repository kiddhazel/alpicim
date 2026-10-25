import { AlertTriangle, Inbox, KeyRound, Loader2, MonitorSmartphone, WifiOff, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { AppError } from '../lib/tauri';
import { cx } from './primitives';

export type StateKind = 'loading' | 'empty' | 'error' | 'offline' | 'setup' | 'desktop';

const ICONS: Record<StateKind, LucideIcon> = {
  loading: Loader2,
  empty: Inbox,
  error: AlertTriangle,
  offline: WifiOff,
  setup: KeyRound,
  desktop: MonitorSmartphone,
};

interface Props {
  kind: StateKind;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/** Yükleniyor / boş / hata / çevrimdışı / kurulum gerekli durumları için ortak görünüm. */
export function StateView({ kind, title, description, action, compact }: Props) {
  const Icon = ICONS[kind];
  const tone =
    kind === 'error' ? 'text-down' : kind === 'offline' || kind === 'setup' ? 'text-warn' : 'text-accent';
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 px-4 py-6' : 'h-full min-h-40 gap-2 px-6 py-10',
      )}
    >
      <div
        className={cx(
          'flex shrink-0 items-center justify-center rounded-2xl',
          compact ? 'h-12 w-12' : 'h-14 w-14',
          kind === 'error' ? 'bg-down/12' : 'bg-accent-soft',
        )}
      >
        <Icon size={compact ? 22 : 26} strokeWidth={1.5} className={cx(tone, kind === 'loading' && 'animate-spin')} />
      </div>
      <p className="text-base font-medium text-fg">{title}</p>
      {description && <div className="max-w-sm text-sm text-muted">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Bir hatayı kullanıcıya uygun StateView içeriğine çevirir. */
export function describeError(err: unknown): { kind: StateKind; title: string; description: string } {
  const code = err instanceof AppError ? err.code : 'UNKNOWN';
  switch (code) {
    case 'NOT_DESKTOP':
      return { kind: 'desktop', title: t('errors.desktopTitle'), description: t('errors.desktopBody') };
    case 'OFFLINE':
      return { kind: 'offline', title: t('errors.offlineTitle'), description: t('errors.offlineBody') };
    case 'TIMEOUT':
      return { kind: 'offline', title: t('errors.timeoutTitle'), description: t('errors.timeoutBody') };
    case 'API_KEY_MISSING':
      return { kind: 'setup', title: t('errors.keyTitle'), description: t('errors.keyBody') };
    case 'RATE_LIMIT':
      return { kind: 'error', title: t('errors.rateTitle'), description: t('errors.rateBody') };
    case 'DISABLED':
      return { kind: 'setup', title: t('errors.disabledTitle'), description: t('errors.disabledBody') };
    default:
      return {
        kind: 'error',
        title: t('errors.genericTitle'),
        description: err instanceof AppError && err.detail ? err.detail : t('errors.genericBody'),
      };
  }
}

/** Liste yüklenirken gösterilen sade iskelet satırları. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-3.5 w-11/12 animate-pulse rounded bg-surface-3" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
