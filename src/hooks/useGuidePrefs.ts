"use client";

import { useSyncExternalStore } from "react";
import {
  getGuidePrefs,
  getServerGuidePrefs,
  subscribeGuidePrefs,
  type GuidePrefs,
} from "@/lib/storage/guidePrefs";

/** Per-exercise "hide the form guide" flags. All false during SSR and hydration. */
export function useGuidePrefs(): GuidePrefs {
  return useSyncExternalStore(subscribeGuidePrefs, getGuidePrefs, getServerGuidePrefs);
}
