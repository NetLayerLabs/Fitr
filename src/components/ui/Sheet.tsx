"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons/Icons";
import styles from "./Sheet.module.css";

export interface SheetProps {
  open: boolean;
  /** Called on Esc, backdrop tap or the close button. The parent owns `open`. */
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on a modal <dialog>: native top layer + inert background where supported, plus
 * an explicit Tab wrap so focus stays inside, Esc / backdrop / ✕ to close, and focus returned
 * to the opener. The slide-up animation is dropped under prefers-reduced-motion.
 */
export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    // Focus the first control after the close button when there is one, else the close button.
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables[1] ?? focusables[0])?.focus();

    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      opener?.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // A click whose target is the <dialog> itself landed on the backdrop (the panel fills the box).
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className={styles.panel}>
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
