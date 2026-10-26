import { Copy, Minus, Pin, PinOff, Square, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { cx } from './primitives';

interface Props {
  title: string;
  icon?: LucideIcon;
  /** Başlığın yanında, sürükleme alanının içinde kalan eylemler (sayfa araçları). */
  children?: ReactNode;
  /** Başlığın solunda (ör. kenar çubuğu düğmesi). */
  leading?: ReactNode;
  pinned: boolean;
  maximized?: boolean;
  onTogglePin: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  closeLabel?: string;
  /** Tam ekranda false: sürükleme ve standart pencere düğmeleri kapanır. */
  windowed?: boolean;
  /** Pencere düğmelerinin solunda, sürükleme alanı dışında kalan eylemler. */
  trailing?: ReactNode;
}

/**
 * Kenarlıksız pencereler için 48px üst çubuk: sayfa başlığı (20/600), sayfa araçları, pencere düğmeleri.
 * Boş alanlar `data-tauri-drag-region` ile sürüklenir; çift tıklama büyütür/küçültür (Tauri yerleşik).
 */
export function TitleBar({
  title,
  icon: Icon,
  children,
  leading,
  pinned,
  maximized,
  onTogglePin,
  onMinimize,
  onToggleMaximize,
  onClose,
  closeLabel,
  windowed = true,
  trailing,
}: Props) {
  // Tam ekranda pencere sürüklenmez (kenarlıksız tam ekran bozulur).
  const drag = windowed ? { 'data-tauri-drag-region': true } : {};
  return (
    <header {...drag} className="flex h-12 shrink-0 items-center gap-2 pl-4">
      {leading}
      {Icon && <Icon {...drag} size={18} strokeWidth={1.75} className="shrink-0 text-fg-2" />}
      <h1 {...drag} className="truncate font-display text-xl font-semibold text-fg">
        {title}
      </h1>
      <div {...drag} className="flex min-w-0 flex-1 items-center gap-2 px-2">
        {children}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1 pr-1">{trailing}</div>}
      {windowed && (
        <div className="flex h-full items-center">
          <WindowButton icon={pinned ? PinOff : Pin} label={pinned ? t('window.unpin') : t('window.pin')} onClick={onTogglePin} active={pinned} />
          <WindowButton icon={Minus} label={t('window.minimize')} onClick={onMinimize} />
          <WindowButton icon={maximized ? Copy : Square} label={maximized ? t('window.restore') : t('window.maximize')} onClick={onToggleMaximize} />
          <WindowButton icon={X} label={closeLabel ?? t('window.close')} onClick={onClose} danger />
        </div>
      )}
    </header>
  );
}

function WindowButton({
  icon: Icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-12 w-[44px] items-center justify-center transition-colors duration-150',
        active ? 'text-accent' : 'text-fg-2',
        danger ? 'hover:bg-[#e81123] hover:text-white' : 'hover:bg-control-hover hover:text-fg',
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}
