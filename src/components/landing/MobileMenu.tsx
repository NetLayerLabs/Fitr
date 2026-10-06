"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DownloadIcon } from "./LandingIcons";
import styles from "./LandingNav.module.css";

export interface MobileMenuProps {
  links: ReadonlyArray<{ href: string; label: string }>;
  apkHref: string;
}

/**
 * Phones only (hidden from 900 px): a ☰ button that opens the section links and the Download
 * button in a panel under the bar. Closes on a link tap, Escape, or a tap outside.
 */
export default function MobileMenu({ links, apkHref }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.menu}>
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.burger} data-open={open ? "" : undefined} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div id={panelId} className={styles.menuPanel} data-open={open ? "" : undefined} hidden={!open}>
        <nav aria-label="Sections">
          <ul role="list">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={apkHref} className={styles.menuDownload} onClick={() => setOpen(false)}>
          <DownloadIcon size={18} strokeWidth={2.25} />
          Download for Android
        </a>
      </div>
    </div>
  );
}
