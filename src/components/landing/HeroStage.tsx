"use client";

import { useRef, type ReactNode } from "react";

/**
 * The hero visual's container. With a fine pointer it writes the pointer position as
 * --px / --py (each -1..1) so the layers can drift by depth; CSS does the easing.
 */
export default function HeroStage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", (((clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--py", (((clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
  }

  function leave() {
    cancelAnimationFrame(frame.current);
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  }

  return (
    <div ref={ref} className={className} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}
