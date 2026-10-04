"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Optional count badge (e.g. exercises in a category). */
  count?: number;
  disabled?: boolean;
}

/**
 * Pill filter chip. Renders as role="radio" so a ChipRow behaves as a single-select radio group
 * (arrow keys move + select, one tab stop).
 */
export function Chip({ selected, onClick, children, count, disabled }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className={`${styles.chip} ${selected ? styles.selected : ""}`}
      onClick={onClick}
    >
      <span className={styles.text}>{children}</span>
      {count !== undefined ? (
        <span className={styles.count}>
          <span className="sr-only">, </span>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export interface ChipRowProps {
  /** Accessible name of the group (e.g. "Category"). */
  label: string;
  children: ReactNode;
}

function radios(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
}

/** Horizontally scrollable, single-select chip group (WAI-ARIA radio group pattern). */
export function ChipRow({ label, children }: ChipRowProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Roving tabindex: the checked chip (or the first one) is the group's single tab stop.
  // Runs after every render so it tracks whichever chip the parent marks selected.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = radios(root);
    const active = items.find((el) => el.getAttribute("aria-checked") === "true") ?? items[0];
    for (const el of items) el.tabIndex = el === active ? 0 : -1;
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const root = ref.current;
    if (!root) return;
    const items = radios(root);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = items[next];
    target.focus();
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    target.click();
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={styles.row} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export default Chip;
