"use client";

import { useEffect } from "react";

/**
 * One listener for the whole landing page: while a mouse is over a `[data-spotlight]` card,
 * write the pointer position into that card as --mx / --my so its <Glare /> follows it.
 */
export default function Spotlight() {
  useEffect(() => {
    let frame = 0;
    function move(e: PointerEvent) {
      if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
      const card = e.target.closest<HTMLElement>("[data-spotlight]");
      if (!card) return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${clientX - r.left}px`);
        card.style.setProperty("--my", `${clientY - r.top}px`);
      });
    }
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
