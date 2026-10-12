import React from "react";
import { C, display, mono } from "../theme";
import { Bg, Card, useScene } from "../ui/kit";
import { Words } from "../ui/Words";

/** No single key: the real controls on the mainnet vault. */
export const Trust: React.FC = () => {
  const { w } = useScene("trust");
  const deep = "#5E7A00";
  const label: React.CSSProperties = { fontFamily: mono, fontSize: 17, letterSpacing: "0.12em", color: "rgba(10,11,13,0.5)" };
  const big: React.CSSProperties = { marginTop: 14, fontFamily: display, fontWeight: 800, fontSize: 44, letterSpacing: "-0.03em", lineHeight: 1.05 };
  const fine: React.CSSProperties = { marginTop: 16, fontFamily: mono, fontSize: 18, color: "rgba(10,11,13,0.6)" };
  return (
    <Bg tone="light">
      <div style={{ position: "absolute", left: 130, top: 150, fontFamily: display, fontWeight: 800, fontSize: 92, letterSpacing: "-0.045em" }}>
        <Words text="No single key holds the money." at={w("No")} every={5} accent={{ money: deep }} />
      </div>
      <div style={{ position: "absolute", left: 130, top: 330, width: 1660, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        <Card at={w("Squads") - 4} style={{ height: 250 }}>
          <div style={label}>SQUADS MULTISIG · 2 OF 3</div>
          <div style={big}>Owns the program<br />and the pool</div>
          <div style={fine}>GtigawLF6vHyf7H6ZRXh7U2BWDi7Y5UCYmTDeTUJLK39</div>
        </Card>
        <Card at={w("verifiable,") - 4} style={{ height: 250 }}>
          <div style={label}>VERIFIABLE BUILD</div>
          <div style={big}>Deployed binary matches<br />a reproducible build</div>
          <div style={fine}>executable hash 648618ba…3037240</div>
        </Card>
        <Card at={w("verifiable,") + 14} style={{ height: 250 }}>
          <div style={label}>TESTED</div>
          <div style={big}>79 program tests</div>
          <div style={fine}>fuzz: 256 scenarios · ~31,000 transactions · money checked after each</div>
        </Card>
        <Card at={w("five") - 4} lime style={{ height: 250 }}>
          <div style={{ ...label, color: "rgba(10,11,13,0.6)" }}>FITR'S ONLY FEE</div>
          <div style={{ ...big, fontSize: 64 }}>5% of forfeits</div>
          <div style={{ ...fine, color: "rgba(10,11,13,0.7)" }}>nothing from anyone who shows up</div>
        </Card>
      </div>
    </Bg>
  );
};
