// Records the live landing page (fitr.day) in a desktop browser window for the install scene.
//   node scripts/capture-landing.mjs     -> .cache/frames/landing/ (then: ONLY=landing node scripts/encode.mjs)
// 1600x900 CSS px at device scale 2 (frames 3200x1800): the hero, then an eased scroll to the
// "Install on Seeker" steps (#install). Marks: landing_install (scroll arrives).
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const VIEW = { w: 1600, h: 900, scale: 2 };
const marksFile = join(ROOT, ".cache/marks.json");
const marks = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};
const b = await launch({ width: VIEW.w, height: VIEW.h, extraArgs: [`--force-device-scale-factor=${VIEW.scale}`] });
await b.send("Emulation.setDeviceMetricsOverride", { width: VIEW.w, height: VIEW.h, deviceScaleFactor: VIEW.scale, mobile: false });
await b.goto("https://fitr.day/", 7000);
const dir = join(ROOT, ".cache/frames/landing");
rmSync(dir, { recursive: true, force: true });
const stop = await b.screencast(dir, { maxWidth: VIEW.w * VIEW.scale, maxHeight: VIEW.h * VIEW.scale });
marks["landing:start"] = Date.now() / 1000;
await sleep(4200);
await b.js(`(() => { const el = document.scrollingElement; const to = document.querySelector('#install').getBoundingClientRect().top + scrollY - 60; const from = el.scrollTop; const t0 = performance.now(); const ms = 3600;
  const f = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return new Promise((done) => { const step = (now) => { const p = Math.min(1, (now - t0) / ms); el.scrollTop = from + (to - from) * f(p); if (p < 1) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }); })()`);
marks.landing_install = Date.now() / 1000;
await sleep(9000);
marks["landing:end"] = Date.now() / 1000;
const frames = await stop();
writeFileSync(marksFile, JSON.stringify(marks, null, 1));
console.log(`landing: ${frames.length} frames`);
if (b.consoleLines.length) console.log(b.consoleLines.slice(0, 5).join("\n"));
b.close();
