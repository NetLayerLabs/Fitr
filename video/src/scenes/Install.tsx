import React from "react";
import footage from "../footage.json";
import { C } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Browser } from "../ui/Browser";
import { Chip } from "../ui/Chip";

const ARRIVE = (footage as unknown as Record<string, { marks?: Record<string, number> }>).landing?.marks?.landing_install ?? 234;
const START = 30; // frames into the recording (the hero has settled)
const RATE = 1.5;

/** Where to get it: the real fitr.day, scrolled to its "Install on Seeker" steps (an APK, not Play Store). */
export const Install: React.FC = () => {
  const { w } = useScene("install");
  const arrive = Math.round((ARRIVE - START) / RATE);
  return (
    <Bg tone="light">
      <div style={{ position: "absolute", left: 110, top: 120 }}>
        <Kicker color="#5E7A00" at={2}>Get Fitr · fitr.day</Kicker>
      </div>
      <Browser name="landing" url="https://fitr.day" width={1180} left={110} top={175} startFrom={START} rate={RATE}
        focus={{ x: 1120, y: 300, w: 420, h: 300 }} zoom={1.9} focusAt={[arrive + 10, arrive + 40]} />
      <div style={{ position: "absolute", left: 1350, top: 200, width: 460, display: "flex", flexDirection: "column", gap: 16 }}>
        <Chip at={w("download")} index="1" title="Download the APK" detail="on your Seeker, from fitr.day" />
        <Chip at={w("open")} index="2" title="Open fitr.apk" detail="allow your browser to install apps" />
        <Chip at={w("allow")} index="3" title="Install anyway" detail="Play Protect warns: it's not from Google Play" />
        <Chip at={w("install.") + 14} tone="lime" index="✓" title="Train free on any Android" detail="stake on your Seeker" />
      </div>
    </Bg>
  );
};
