"use client";

import { useSyncExternalStore } from "react";
import { nativeVersion } from "@/lib/native/bridge";
import styles from "./You.module.css";

const noopSubscribe = () => () => {};

/**
 * "Fitr 1.1.0 (build 3) · web 0.3.0" inside the Android app (version from the native bridge,
 * reported as "<versionName>+<versionCode>"), or "Fitr web 0.3.0" in a browser.
 */
export default function AppVersion({ webVersion }: { webVersion: string }) {
  const native = useSyncExternalStore(noopSubscribe, () => nativeVersion() ?? "", () => "");
  const [name, code] = native.split("+");
  return (
    <p className={styles.version}>
      {native ? (
        <>
          Fitr {name}
          {code ? ` (build ${code})` : ""} · web {webVersion}
        </>
      ) : (
        <>Fitr web {webVersion}</>
      )}
    </p>
  );
}
