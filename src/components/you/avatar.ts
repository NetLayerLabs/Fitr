"use client";

/**
 * Profile photo, kept on this device only (localStorage). It is never uploaded: Fitr has no
 * accounts, and the wallet address is the identity.
 *
 * External store for useSyncExternalStore (same pattern as preferences.ts). The user frames the
 * photo in AvatarCropper, which exports an AVATAR_SIZE px square JPEG (~15–40 KB), so it fits
 * comfortably in localStorage.
 */
import { useSyncExternalStore } from "react";

export const AVATAR_STORAGE_KEY = "fitr.avatar.v1";
export const AVATAR_SIZE = 256;
/** Reject absurd inputs before decoding (camera photos are usually < 15 MB). */
export const MAX_AVATAR_INPUT_BYTES = 25 * 1024 * 1024;

let cache: string | null | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function getAvatar(): string | null {
  if (typeof window === "undefined") return null;
  if (cache === undefined) {
    try {
      const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
      cache = isImageDataUrl(raw) ? raw : null;
    } catch {
      cache = null;
    }
  }
  return cache;
}

function getServerAvatar(): string | null {
  return null;
}

export function setAvatar(dataUrl: string | null): void {
  if (dataUrl !== null && !isImageDataUrl(dataUrl)) throw new Error("Not an image");
  cache = dataUrl;
  try {
    if (dataUrl === null) window.localStorage.removeItem(AVATAR_STORAGE_KEY);
    else window.localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
  } catch {
    // Quota or blocked storage: keep it for this session only.
  }
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== AVATAR_STORAGE_KEY && event.key !== NAME_STORAGE_KEY) return;
  cache = undefined;
  nameCache = undefined;
  emit();
}

export function subscribeAvatar(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Test hook. */
export function resetAvatarCache(): void {
  cache = undefined;
}

export function useAvatar(): string | null {
  return useSyncExternalStore(subscribeAvatar, getAvatar, getServerAvatar);
}

// ---------------------------------------------------------------------------------------
// Display name (also device-only)
// ---------------------------------------------------------------------------------------

export const NAME_STORAGE_KEY = "fitr.name.v1";
export const MAX_NAME_LENGTH = 30;

let nameCache: string | undefined;

/** Trim, collapse whitespace, strip control characters, cap the length. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function getName(): string {
  if (typeof window === "undefined") return "";
  if (nameCache === undefined) {
    try {
      nameCache = cleanName(window.localStorage.getItem(NAME_STORAGE_KEY) ?? "");
    } catch {
      nameCache = "";
    }
  }
  return nameCache;
}

function getServerName(): string {
  return "";
}

export function setName(raw: string): void {
  const next = cleanName(raw);
  nameCache = next;
  try {
    if (next === "") window.localStorage.removeItem(NAME_STORAGE_KEY);
    else window.localStorage.setItem(NAME_STORAGE_KEY, next);
  } catch {
    // keep for this session
  }
  emit();
}

/** Test hook. */
export function resetNameCache(): void {
  nameCache = undefined;
}

export function useProfileName(): string {
  return useSyncExternalStore(subscribeAvatar, getName, getServerName);
}
