import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/* Alpicim 1.0 bileşenleri (docs/dev/redesign-v1.md §5): düz yüzeyler, tek vurgu, 12/8/6 köşe, 32px kontrol. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

/* ───────────── Button / IconButton ───────────── */

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
  /** md = 32px, sm = 28px (yoğun) */
  size?: 'sm' | 'md';
  spin?: boolean;
}

/** Yalnız ikonlu düğme. Erişilebilirlik için `label` hem ipucu hem aria-label olur. */
export function IconButton({
  icon: Icon,
  label,
  active,
  tone = 'default',
  size = 'md',
  spin,
  className,
  ...rest
}: IconButtonProps) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ease-[cubic-bezier(.2,0,0,1)] disabled:cursor-not-allowed disabled:opacity-40',
        FOCUS,
        dim,
        active ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-control-hover hover:text-fg active:bg-control',
        tone === 'danger' && 'hover:!bg-down/15 hover:!text-down',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 16} strokeWidth={1.75} className={spin ? 'animate-spin' : undefined} />
    </button>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** md = 32px, sm = 28px (yoğun) */
  size?: 'sm' | 'md';
}

export function Button({ icon: Icon, variant = 'secondary', size = 'md', className, children, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover active:opacity-90',
    secondary:
      'bg-control text-fg shadow-[inset_0_0_0_1px_var(--stroke)] hover:bg-control-hover active:opacity-90',
    ghost: 'text-fg-2 hover:bg-control-hover hover:text-fg active:bg-control',
    danger: 'bg-down/12 text-down hover:bg-down/20 active:opacity-90',
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors duration-150 ease-[cubic-bezier(.2,0,0,1)] disabled:cursor-not-allowed disabled:opacity-45',
        FOCUS,
        size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-8 px-3.5 text-sm',
        styles,
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

/* ───────────── Alanlar ───────────── */

const FIELD =
  'h-8 rounded-lg bg-control px-3 text-sm text-fg shadow-[inset_0_0_0_1px_var(--stroke)] transition-shadow duration-150 placeholder:text-fg-3 hover:shadow-[inset_0_0_0_1px_var(--stroke-strong)] focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--accent),0_0_0_1px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, 'min-w-0', className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cx(FIELD, 'pl-2.5 pr-2', className)} {...rest}>
      {children}
    </select>
  );
}

/** Alanın üstünde etiket + altında ipucu/hata. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {children}
      {(error ?? hint) && <span className={cx('text-xs', error ? 'text-down' : 'text-fg-3')}>{error ?? hint}</span>}
    </label>
  );
}

/* ───────────── Badge ───────────── */

export type BadgeTone = 'neutral' | 'accent' | 'up' | 'down' | 'warn' | 'demo';

export function Badge({ tone = 'neutral', children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  const styles: Record<BadgeTone, string> = {
    neutral: 'bg-control text-fg-2',
    accent: 'bg-accent-soft text-accent',
    up: 'bg-up/14 text-up',
    down: 'bg-down/14 text-down',
    warn: 'bg-warn/16 text-warn',
    demo: 'bg-demo/16 text-demo font-semibold tracking-wide',
  };
  return (
    <span
      title={title}
      className={cx('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-xs font-semibold leading-none', styles[tone])}
    >
      {children}
    </span>
  );
}

/* ───────────── Segmented / Toggle ───────────── */

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-8 items-center gap-0.5 rounded-lg bg-control p-0.5 shadow-[inset_0_0_0_1px_var(--stroke)]"
    >
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            title={l}
            onClick={() => onChange(v)}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm transition-colors duration-150',
              FOCUS,
              on ? 'bg-raised font-semibold text-fg shadow-card' : 'text-fg-2 hover:text-fg',
            )}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            <span className={Icon ? 'hidden sm:inline' : undefined}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        FOCUS,
        checked ? 'bg-accent' : 'bg-transparent shadow-[inset_0_0_0_1px_var(--text-3)] hover:shadow-[inset_0_0_0_1px_var(--text-2)]',
      )}
    >
      <span
        className={cx(
          'inline-block rounded-full transition-all duration-150 ease-[cubic-bezier(.2,0,0,1)]',
          checked ? 'h-3.5 w-3.5 translate-x-[22px] bg-on-accent' : 'h-3 w-3 translate-x-[4px] bg-fg-2',
        )}
      />
    </button>
  );
}

/* ───────────── Card ───────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Tıklanabilir kart için hover rengi. */
  interactive?: boolean;
}

/** Kart yüzeyi: 12px köşe, 1px kenar, açık temada hafif gölge. */
export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--stroke),var(--shadow-card)]',
        interactive && 'cursor-pointer transition-colors duration-150 hover:bg-card-hover',
        className,
      )}
      {...rest}
    />
  );
}

/** Başlık 16/600 solda, eylemler sağda. */
export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex min-h-[48px] items-center justify-between gap-3 px-4 pt-3', className)}>
      <div className="min-w-0">
        <h3 className="truncate font-display text-lg font-semibold text-fg">{title}</h3>
        {subtitle && <p className="truncate text-xs text-fg-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function CardBody({ dense, className, ...rest }: HTMLAttributes<HTMLDivElement> & { dense?: boolean }) {
  return <div className={cx(dense ? 'p-3' : 'p-4', className)} {...rest} />;
}

/* ───────────── List ───────────── */

export function List({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div role="list" className={cx('flex flex-col gap-0.5', className)} {...rest} />;
}

interface ListItemProps {
  icon?: LucideIcon;
  /** İkon yerine özel öncü öğe (avatar, küçük görsel). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  /** 44px yerine 36px. */
  dense?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ListItem({ icon: Icon, leading, title, subtitle, trailing, selected, dense, onClick, className }: ListItemProps) {
  const body = (
    <>
      {Icon && <Icon size={16} strokeWidth={1.75} className={cx('shrink-0', selected ? 'text-accent' : 'text-fg-2')} />}
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate', dense ? 'text-sm' : 'text-base', selected ? 'font-semibold text-fg' : 'text-fg')}>
          {title}
        </span>
        {subtitle && <span className="block truncate text-xs text-fg-3">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-sm text-fg-2">{trailing}</span>}
    </>
  );
  const cls = cx(
    'flex w-full items-center gap-3 rounded-lg px-3 text-left transition-colors duration-150',
    dense ? 'min-h-9' : 'min-h-11',
    Boolean(subtitle) && !dense && 'py-1.5',
    selected ? 'bg-accent-soft' : onClick && 'hover:bg-card-hover',
    className,
  );
  return onClick ? (
    <button type="button" role="listitem" onClick={onClick} aria-current={selected || undefined} className={cx(cls, FOCUS)}>
      {body}
    </button>
  ) : (
    <div role="listitem" className={cls}>
      {body}
    </div>
  );
}

/* ───────────── EmptyState ───────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-1 px-6 py-10 text-center', className)}>
      <Icon size={32} strokeWidth={1.5} className="mb-2 text-fg-3" />
      <p className="text-base font-semibold text-fg">{title}</p>
      {description && <p className="max-w-[320px] text-sm text-fg-2">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ───────────── Toolbar / Tabs ───────────── */

export function Toolbar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div role="toolbar" className={cx('flex min-h-8 items-center gap-2', className)} {...rest} />;
}

export function ToolbarSeparator() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-stroke-strong" />;
}

interface TabsProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon; count?: number }>;
  onChange: (value: T) => void;
  label: string;
}

/** Alt çizgili sekmeler (sayfa içi bölümler). */
export function Tabs<T extends string>({ value, options, onChange, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex items-end gap-1 border-b border-stroke">
      {options.map(({ value: v, label: l, icon: Icon, count }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(v)}
            className={cx(
              'relative inline-flex h-9 items-center gap-1.5 rounded-t-lg px-3 text-sm transition-colors duration-150',
              FOCUS,
              on ? 'font-semibold text-fg' : 'text-fg-2 hover:text-fg',
            )}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {l}
            {count !== undefined && <span className="text-xs text-fg-3 tabular-nums">{count}</span>}
            {on && <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-3">{children}</h3>
      {action}
    </div>
  );
}
