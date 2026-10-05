"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { AVATAR_SIZE } from "./avatar";
import styles from "./AvatarCropper.module.css";

/** Square viewport the user frames the photo in (CSS px); the circle is inscribed in it. */
const VIEW = 280;
const MAX_ZOOM = 4;

interface Frame {
  /** Displayed scale (CSS px per image px). */
  scale: number;
  /** Image top-left relative to the viewport (CSS px). */
  x: number;
  y: number;
}

/** Scale at which the image just covers the viewport (zoom 1). */
export function coverScale(width: number, height: number, view = VIEW): number {
  return view / Math.min(width, height);
}

/** Keep the image covering the whole viewport: no empty gaps inside the frame. */
export function clampFrame(f: Frame, width: number, height: number, view = VIEW): Frame {
  const w = width * f.scale;
  const h = height * f.scale;
  return {
    scale: f.scale,
    x: Math.min(0, Math.max(view - w, f.x)),
    y: Math.min(0, Math.max(view - h, f.y)),
  };
}

/** Zoom to `scale` keeping the image point under (px, py) fixed. */
export function zoomFrame(f: Frame, scale: number, px: number, py: number, width: number, height: number, view = VIEW): Frame {
  const ix = (px - f.x) / f.scale;
  const iy = (py - f.y) / f.scale;
  return clampFrame({ scale, x: px - ix * scale, y: py - iy * scale }, width, height, view);
}

/** Source square (image px) currently inside the viewport. */
export function sourceRect(f: Frame, view = VIEW): { sx: number; sy: number; size: number } {
  return { sx: -f.x / f.scale, sy: -f.y / f.scale, size: view / f.scale };
}

export interface AvatarCropperProps {
  file: File;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

/** Drag to position, pinch / wheel / slider to zoom, inside a circular preview. */
export default function AvatarCropper({ file, onCancel, onSave }: AvatarCropperProps) {
  const t = useT("you");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<"cropOpenFailed" | "cropProcessFailed" | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let cancelled = false;
    image.onload = () => {
      if (cancelled) return;
      const s = coverScale(image.naturalWidth, image.naturalHeight);
      setImg(image);
      setFrame({
        scale: s,
        x: (VIEW - image.naturalWidth * s) / 2,
        y: (VIEW - image.naturalHeight * s) / 2,
      });
    };
    image.onerror = () => {
      if (!cancelled) setError("cropOpenFailed");
    };
    image.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (error) {
    return (
      <div className={styles.wrap}>
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            {t("cropClose")}
          </button>
        </div>
      </div>
    );
  }
  if (!img || !frame) return <p className={styles.loading}>{t("cropLoading")}</p>;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const base = coverScale(w, h);
  const zoom = frame.scale / base;

  const setZoom = (z: number, px = VIEW / 2, py = VIEW / 2) =>
    setFrame((f) => (f ? zoomFrame(f, base * Math.min(MAX_ZOOM, Math.max(1, z)), px, py, w, h) : f));
  const pan = (dx: number, dy: number) =>
    setFrame((f) => (f ? clampFrame({ ...f, x: f.x + dx, y: f.y + dy }, w, h) : f));

  function localPoint(e: { clientX: number; clientY: number }) {
    const r = viewRef.current?.getBoundingClientRect();
    const k = r ? VIEW / r.width : 1;
    return { x: r ? (e.clientX - r.left) * k : VIEW / 2, y: r ? (e.clientY - r.top) * k : VIEW / 2 };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: zoom };
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const mid = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      setZoom((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist, mid.x, mid.y);
    } else if (pointers.current.size === 1) {
      const r = viewRef.current?.getBoundingClientRect();
      const k = r ? VIEW / r.width : 1;
      pan((e.clientX - prev.x) * k, (e.clientY - prev.y) * k);
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const p = localPoint(e);
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), p.x, p.y);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      pan(...moves[e.key]);
    } else if (e.key === "+" || e.key === "=") {
      setZoom(zoom * 1.1);
    } else if (e.key === "-") {
      setZoom(zoom / 1.1);
    }
  }

  function save() {
    if (!img || !frame) return;
    const { sx, sy, size } = sourceRect(frame);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("cropProcessFailed");
      return;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    onSave(canvas.toDataURL("image/jpeg", 0.88));
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={viewRef}
        className={styles.viewport}
        role="application"
        aria-label={t("cropViewportLabel")}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL being framed */}
        <img
          src={img.src}
          alt=""
          draggable={false}
          className={styles.image}
          style={{
            width: `${(w * frame.scale * 100) / VIEW}%`,
            left: `${(frame.x * 100) / VIEW}%`,
            top: `${(frame.y * 100) / VIEW}%`,
          }}
        />
        <div className={styles.mask} aria-hidden="true" />
      </div>

      <label className={styles.zoom}>
        <span className={styles.zoomLabel}>{t("cropZoom")}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className={styles.slider}
        />
      </label>
      <p className={styles.hint}>{t("cropHint")}</p>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t("cropCancel")}
        </button>
        <button type="button" className={styles.primary} onClick={save}>
          {t("cropSave")}
        </button>
      </div>
    </div>
  );
}
