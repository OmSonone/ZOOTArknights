import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./ui";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Dialog({ open, onClose, title, subtitle, children, footer, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="neu-dialog"
      style={wide ? { width: "min(940px, 94vw)" } : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="neu-dialog__panel">
          <header className="neu-dialog__head">
            <div className="neu-dialog__title">
              <h2 className="title">{title}</h2>
              {subtitle != null && <p className="hint" style={{ marginTop: 2 }}>{subtitle}</p>}
            </div>
            <IconButton icon="close" label="Close" variant="ghost" size="sm" onClick={onClose} />
          </header>
          <div className="neu-dialog__body">{children}</div>
          {footer != null && <footer className="neu-dialog__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
