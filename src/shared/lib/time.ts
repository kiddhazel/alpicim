import { t } from '../../i18n';

const LOCALE = 'tr-TR';

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce" ya da tarih. */
export function formatRelative(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp) return t('time.unknown');
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('time.daysAgo', { n: days });
  return formatDate(timestamp);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }).format(
    timestamp,
  );
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function formatNumber(value: number, fractionDigits = 4): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: Math.min(2, fractionDigits),
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value)}%`;
}

/** YYYY-MM-DD (yerel saat değil, UTC tarih). */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
