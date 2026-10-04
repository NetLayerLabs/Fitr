"use client";

import { useSyncExternalStore } from "react";
import { nativeVersion } from "@/lib/native/bridge";
import styles from "./You.module.css";

const noopSubscribe = () => () => {};

/**
 * "Fitr 1.1.0": the Android app's version (from the native bridge, reported as
 * "<versionName>+<versionCode>"). Outside the app (local development) it falls back to the
 * web package version.
 */
export default function AppVersion({ webVersion }: { webVersion: string }) {
  const native = useSyncExternalStore(noopSubscribe, () => nativeVersion() ?? "", () => "");
  const name = native.split("+")[0];
  return <p className={styles.version}>Fitr {name || webVersion}</p>;
}
