import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </header>
  );
}

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    busy?: boolean;
  }
>;

export function Button({
  children,
  variant = 'secondary',
  className = '',
  busy = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <LoaderCircle size={16} className="spin" aria-hidden /> : children}
    </button>
  );
}

export function StatusPill({
  tone,
  children,
}: PropsWithChildren<{ tone: 'positive' | 'warning' | 'neutral' | 'info' }>) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      data-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span>{checked ? <Check size={12} strokeWidth={3} /> : null}</span>
    </button>
  );
}

export function ExternalLinkButton({
  children,
  onClick,
  ariaLabel,
}: PropsWithChildren<{ onClick(): void; ariaLabel?: string }>) {
  return (
    <button className="external-link" onClick={onClick} aria-label={ariaLabel}>
      <span>{children}</span>
      <ArrowUpRight size={15} aria-hidden />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
