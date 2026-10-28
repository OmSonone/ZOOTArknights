import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  iconOnly?: boolean;
}

export function Button({
  variant = "default",
  size = "md",
  block = false,
  iconOnly = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "neu-btn",
        variant !== "default" && `neu-btn--${variant}`,
        size !== "md" && `neu-btn--${size}`,
        block && "neu-btn--block",
        iconOnly && "neu-btn--icon",
        className,
      )}
      {...rest}
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "iconOnly" | "children"> {
  icon: IconName;
  label: string;
  size?: Size;
  filledIcon?: boolean;
}

export function IconButton({ icon, label, filledIcon, size = "md", ...rest }: IconButtonProps) {
  return (
    <Button iconOnly size={size} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === "sm" ? 16 : size === "lg" ? 22 : 19} filled={filledIcon} />
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Chip / Segmented / Tabs                                             */
/* ------------------------------------------------------------------ */

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

export function Chip({ pressed = false, className, children, ...rest }: ChipProps) {
  return (
    <button type="button" className={cx("neu-chip", className)} aria-pressed={pressed} {...rest}>
      {children}
    </button>
  );
}

export interface Option<T> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
  title?: string;
}

interface SegmentedProps<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className="seg__opt"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface TabOption<T> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T> {
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Tabs<T extends string | number>({ tabs, value, onChange, ariaLabel }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={String(tab.id)}
          type="button"
          role="tab"
          className="tabs__tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: Size;
  disabled?: boolean;
  label?: string;
  format?: (value: number) => string;
  editable?: boolean;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  size = "md",
  disabled = false,
  label,
  format,
  editable = true,
}: StepperProps) {
  const clamp = (next: number) => Math.min(Math.max(next, min), max);
  const [draft, setDraft] = useState(String(value));
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
    setDraft(String(value));
  }, [value]);

  const repeat = useRef<{ timeout: number | null; interval: number | null }>({ timeout: null, interval: null });

  const stopRepeat = () => {
    if (repeat.current.timeout != null) window.clearTimeout(repeat.current.timeout);
    if (repeat.current.interval != null) window.clearInterval(repeat.current.interval);
    repeat.current = { timeout: null, interval: null };
  };

  useEffect(() => stopRepeat, []);

  const stepBy = (direction: 1 | -1, amount = step) => {
    const next = clamp(valueRef.current + direction * amount);
    if (next === valueRef.current) return;
    valueRef.current = next;
    onChange(next);
  };

  const startRepeat = (direction: 1 | -1) => {
    stepBy(direction);
    stopRepeat();
    repeat.current.timeout = window.setTimeout(() => {
      repeat.current.interval = window.setInterval(() => stepBy(direction), 70);
    }, 400);
  };

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      const next = clamp(Math.round(parsed));
      setDraft(String(next));
      valueRef.current = next;
      if (next !== value) onChange(next);
    } else {
      setDraft(String(value));
    }
  };

  const decrementDisabled = disabled || value <= min;
  const incrementDisabled = disabled || value >= max;

  return (
    <div className={cx("stepper", size === "lg" && "stepper--lg")} role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        aria-label={label ? `Decrease ${label}` : "Decrease"}
        disabled={decrementDisabled}
        onClick={() => stepBy(-1)}
        onPointerDown={() => startRepeat(-1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        <Icon name="minus" size={size === "lg" ? 18 : 15} />
      </button>
      <span className="stepper__value">
        {editable ? (
          <input
            value={draft}
            size={3}
            inputMode="numeric"
            aria-label={label}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setDraft(String(value));
            }}
          />
        ) : (
          (format ?? String)(value)
        )}
      </span>
      <button
        type="button"
        className="stepper__btn"
        aria-label={label ? `Increase ${label}` : "Increase"}
        disabled={incrementDisabled}
        onClick={() => stepBy(1)}
        onPointerDown={() => startRepeat(1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        <Icon name="plus" size={size === "lg" ? 18 : 15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="neu-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  shortcut?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  inputRef,
  shortcut,
  ...rest
}: SearchInputProps) {
  return (
    <div className="search">
      <Icon name="search" size={17} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
      {value ? (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => onChange("")}>
          <Icon name="close" size={12} />
        </button>
      ) : (
        shortcut && (
          <kbd className="kbd" aria-hidden="true">
            {shortcut}
          </kbd>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats / progress / badges / empty                                   */
/* ------------------------------------------------------------------ */

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint != null && <span className="hint">{hint}</span>}
    </div>
  );
}

interface BarProps {
  value: number;
  label?: string;
}

export function Bar({ value, label }: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
  color?: string;
}

export function ProgressRing({ value, size = 96, stroke = 9, label, sublabel, color }: RingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color ?? "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 320ms var(--ease)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <span className="num" style={{ fontSize: size * 0.22, lineHeight: 1.1 }}>
          {label}
        </span>
        {sublabel != null && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{sublabel}</span>}
      </div>
    </div>
  );
}

type Tone = "default" | "accent" | "success" | "warning" | "danger";

export function Badge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("badge", tone !== "default" && `badge--${tone}`)}>{children}</span>;
}

interface EmptyProps {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
}

export function Empty({ icon = "sparkles", title, children }: EmptyProps) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={24} />
      </span>
      <strong style={{ color: "var(--text-soft)", fontWeight: 600 }}>{title}</strong>
      {children != null && <div className="hint" style={{ maxWidth: 380 }}>{children}</div>}
    </div>
  );
}
