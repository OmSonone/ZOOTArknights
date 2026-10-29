import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string | number> {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  size?: "sm" | "md";
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  limit?: number;
  id?: string;
}

interface Anchor {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  sheet: boolean;
}

const MOBILE_BREAKPOINT = 640;
const PANEL_GAP = 8;
const PANEL_MAX_HEIGHT = 320;

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  size = "md",
  searchable,
  disabled = false,
  className,
  limit = 80,
  id,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const canSearch = searchable ?? options.length > 9;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(needle) || option.description?.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const computeAnchor = useCallback((): Anchor => {
    const element = triggerRef.current;
    if (!element) return { left: 8, width: 240, top: 8, sheet: false };
    const rect = element.getBoundingClientRect();
    const sheet = window.innerWidth <= MOBILE_BREAKPOINT;
    if (sheet) return { left: 0, width: window.innerWidth, sheet };

    const width = Math.min(Math.max(rect.width, 210), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP;
    const spaceAbove = rect.top - PANEL_GAP;
    const placeAbove = spaceBelow < Math.min(PANEL_MAX_HEIGHT, 220) && spaceAbove > spaceBelow;

    return placeAbove
      ? { left, width, bottom: window.innerHeight - rect.top + PANEL_GAP, sheet }
      : { left, width, top: rect.bottom + PANEL_GAP, sheet };
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) return;
    setQuery("");
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    setAnchor(computeAnchor());
    setOpen(true);
  }, [computeAnchor, disabled, options, value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (option: SelectOption<T>) => {
      onChange(option.value);
      close();
    },
    [close, onChange],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (canSearch) searchRef.current?.focus();
      else panelRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, canSearch]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => setAnchor(computeAnchor());
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, computeAnchor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [open, active, shown.length]);

  useEffect(() => {
    if (shown.length === 0) {
      if (active !== 0) setActive(0);
      return;
    }
    if (active > shown.length - 1) setActive(shown.length - 1);
  }, [shown.length, active]);

  const onPanelKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => (shown.length ? (index + 1) % shown.length : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => (shown.length ? (index - 1 + shown.length) % shown.length : 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(Math.max(shown.length - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (shown[active]) choose(shown[active]);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`neu-select${size === "sm" ? " neu-select--sm" : ""}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) openPanel();
          }
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close();
          }
        }}
      >
        <span className="neu-select__value">
          {selected?.icon != null && <span className="neu-select__icon">{selected.icon}</span>}
          <span className="neu-select__label truncate">{selected?.label ?? placeholder}</span>
        </span>
        <Icon name="chevronDown" size={15} className="neu-select__chevron" />
      </button>

      {open &&
        anchor &&
        createPortal(
          <>
            {anchor.sheet && <div className="neu-select__backdrop" onClick={() => close(false)} />}
            <div
              ref={panelRef}
              className={`neu-select__panel${anchor.sheet ? " neu-select__panel--sheet" : ""}`}
              style={
                anchor.sheet
                  ? undefined
                  : {
                      left: anchor.left,
                      width: anchor.width,
                      top: anchor.top,
                      bottom: anchor.bottom,
                    }
              }
              role="listbox"
              aria-label={ariaLabel}
              tabIndex={-1}
              onKeyDown={onPanelKeyDown}
            >
              {anchor.sheet && <span className="neu-select__handle" aria-hidden="true" />}
              {canSearch && (
                <div className="search neu-select__search">
                  <Icon name="search" size={15} />
                  <input
                    ref={searchRef}
                    value={query}
                    placeholder={`Search ${options.length} options…`}
                    aria-label={`Search ${ariaLabel}`}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                  />
                </div>
              )}

              <div className="neu-select__list" ref={listRef}>
                {shown.length === 0 && <div className="neu-select__empty">No matches</div>}
                {shown.map((option, index) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    data-active={index === active}
                    className="neu-select__option"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    {option.icon != null && <span className="neu-select__icon">{option.icon}</span>}
                    <span className="neu-select__option-main">
                      <span className="truncate">{option.label}</span>
                      {option.description && <span className="neu-select__desc truncate">{option.description}</span>}
                    </span>
                    {option.value === value && <Icon name="check" size={15} />}
                  </button>
                ))}
                {filtered.length > shown.length && (
                  <div className="neu-select__more">
                    …and {filtered.length - shown.length} more — keep typing to narrow it down
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
