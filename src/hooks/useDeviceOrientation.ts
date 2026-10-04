"use client";

import { useSyncExternalStore } from "react";
import { nextOrientationStatus, sceneRoll, type OrientationStatus } from "@/lib/pose/runtime/orientation";

/**
 * Whether the phone is held upright, from DeviceOrientationEvent (see runtime/orientation.ts).
 *
 * "unknown" when there is no sensor, no reading yet, the permission was denied (iOS), or the
 * phone lies flat; callers must treat that as "do not block". Readings are only listened to
 * while at least one component subscribes with `enabled`.
 */

let status: OrientationStatus = "unknown";
const listeners = new Set<() => void>();

function screenAngle(): number {
  const angle = typeof screen !== "undefined" ? screen.orientation?.angle : undefined;
  if (typeof angle === "number") return angle;
  // iOS < 16.4 has no screen.orientation; window.orientation is -90 / 0 / 90 / 180.
  const legacy = (window as Window & { orientation?: unknown }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

function onDeviceOrientation(event: DeviceOrientationEvent): void {
  const next = nextOrientationStatus(status, sceneRoll(event.beta, event.gamma, screenAngle()));
  if (next === status) return;
  status = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("deviceorientation", onDeviceOrientation);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      status = "unknown";
    }
  };
}

const subscribeNothing = () => () => {};
const getStatus = () => status;
const getUnknown = (): OrientationStatus => "unknown";

export function useDeviceOrientation(enabled: boolean): OrientationStatus {
  const current = useSyncExternalStore(enabled ? subscribe : subscribeNothing, getStatus, getUnknown);
  return enabled ? current : "unknown";
}

/**
 * iOS 13+ only delivers orientation events after DeviceOrientationEvent.requestPermission(),
 * which must be called from a user gesture (e.g. the Start button's click handler). Fire and
 * forget: a denial just leaves the status "unknown". A no-op everywhere else.
 */
export function requestDeviceOrientationAccess(): void {
  if (typeof DeviceOrientationEvent === "undefined") return;
  const ctor = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<unknown> };
  if (typeof ctor.requestPermission !== "function") return;
  try {
    ctor.requestPermission().catch(() => undefined);
  } catch {
    // Called outside a gesture or unsupported: orientation just stays unknown.
  }
}
