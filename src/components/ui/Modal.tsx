import { useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/designTokens';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Optional id of the element that describes the dialog. */
  children: ReactNode;
  footer?: ReactNode;
  /** Tailwind max-width class for the panel (defaults to max-w-md). */
  widthClass?: string;
  /** Allows clicks on the backdrop to dismiss the dialog. */
  closeOnBackdrop?: boolean;
}

/**
 * Accessible dialog (Req 12.1–12.6, 20.4, 20.5):
 * backdrop overlay, scroll lock, focus trapping, ESC to close and focus
 * restoration to the previously active element.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClass = 'max-w-md',
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /* Move focus into the dialog on open and restore it on close. */
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  /* Lock background scrolling while the dialog is open (Req 12.5). */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    /* ESC closes the dialog (Req 20.5). */
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    /* Keep Tab cycling inside the dialog (Req 20.4 / 12.2). */
    if (e.key !== 'Tab') return;
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = 'modal-title';
  const descriptionId = 'modal-description';

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-gradient-to-br from-surface-raised to-slate-800/90 border border-line-strong',
          'rounded-panel shadow-modal animate-slide-up focus:outline-none',
          widthClass,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-line-subtle">
          <div>
            <h3 id={titleId} className="text-heading text-content-primary">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="text-caption text-content-secondary mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton size="sm" label="Close dialog" onClick={onClose}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="px-6 py-6">{children}</div>

        {footer && <div className="px-6 pb-6 flex gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
