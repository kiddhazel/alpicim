import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
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
  const dim = size === 'sm' ? 'h-[30px] w-[30px]' : 'h-9 w-9';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        dim,
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-3 hover:text-fg',
        tone === 'danger' && 'hover:!bg-danger/15 hover:!text-danger',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} strokeWidth={1.75} className={spin ? 'animate-spin' : undefined} />
    </button>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({ icon: Icon, variant = 'secondary', className, children, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-accent-gradient text-white hover:brightness-110 hover:shadow-[0_0_20px_-4px_var(--accent)]',
    secondary: 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] hover:bg-surface-3',
    ghost: 'text-muted hover:bg-surface-3 hover:text-fg',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-9 min-w-0 rounded-xl bg-surface-2 px-3 text-sm text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cx(
        'h-9 rounded-xl bg-surface-2 px-2.5 text-sm text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] focus:outline-none focus:ring-2 focus:ring-accent/40',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'up' | 'down' | 'warn' | 'demo';

export function Badge({ tone = 'neutral', children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  const styles: Record<BadgeTone, string> = {
    neutral: 'bg-surface-3 text-muted',
    accent: 'bg-accent-soft text-accent',
    up: 'bg-up/12 text-up',
    down: 'bg-down/12 text-down',
    warn: 'bg-warn/15 text-warn',
    demo: 'bg-demo/15 text-demo font-semibold tracking-wide',
  };
  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs leading-4', styles[tone])}
    >
      {children}
    </span>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 items-center rounded-xl bg-surface-2 p-1 shadow-[inset_0_0_0_1px_var(--glass-edge)]">
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          title={l}
          onClick={() => onChange(v)}
          className={cx(
            'inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-sm transition-colors',
            v === value ? 'bg-surface-3 text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {Icon && <Icon size={14} strokeWidth={1.75} />}
          <span className={Icon ? 'hidden sm:inline' : undefined}>{l}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent-gradient' : 'bg-surface-3 shadow-[inset_0_0_0_1px_var(--glass-edge)]',
      )}
    >
      <span
        className={cx(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[19px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{children}</h3>
      {action}
    </div>
  );
}
