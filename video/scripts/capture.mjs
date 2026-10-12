// Records the real, live Fitr app (app.fitr.day, mainnet data) at phone size for the film.
//   node scripts/capture.mjs                 all clips
//   ONLY=workouts,you node scripts/capture.mjs
// The viewport is 390x844 CSS px at device scale 3 (frames 1170x2532), with the Android app's
// user agent so app.fitr.day serves the app. Output: .cache/frames/<clip>/ (screencast JPEGs +
// frames.json), .cache/marks.json, and stills in public/stills/. scripts/encode.mjs makes
// public/footage/<clip>.mp4 (30 fps) and src/footage.json.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const BASE = "https://app.fitr.day";
const UA = "Mozilla/5.0 (Linux; Android 14; Seeker) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Solana Mobile Web Shell FitrApp/1.2.0";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const FRAMES = join(ROOT, ".cache/frames");
const STILLS = join(ROOT, "public/stills");
const VIEW = { w: 390, h: 844, scale: 3 };
const ONLY = process.env.ONLY?.split(",");
const want = (clip) => !ONLY || ONLY.includes(clip);
mkdirSync(FRAMES, { recursive: true });
mkdirSync(STILLS, { recursive: true });
const marksFile = join(ROOT, ".cache/marks.json");
const marks = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};
const mark = (k) => { marks[k] = Date.now() / 1000; console.log("mark", k); };

const b = await launch({ width: VIEW.w, height: VIEW.h, extraArgs: [`--force-device-scale-factor=${VIEW.scale}`] });
await b.send("Emulation.setDeviceMetricsOverride", { width: VIEW.w, height: VIEW.h, deviceScaleFactor: VIEW.scale, mobile: true });
await b.send("Network.enable");
await b.send("Network.setUserAgentOverride", { userAgent: UA });
const hardStop = setTimeout(() => { console.error("HARD TIMEOUT"); b.close(); process.exit(2); }, 600_000);

// Eased scrolling of the page (a calm, thumb-like glide).
const EASE = `window.__ease = (to, ms) => new Promise((done) => {
  const el = document.scrollingElement; const from = el.scrollTop; const start = performance.now();
  const f = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => { const p = Math.min(1, (now - start) / ms); el.scrollTop = from + (to - from) * f(p); if (p < 1) requestAnimationFrame(step); else done(); };
  requestAnimationFrame(step);
})`;
const scrollTo = (expr, ms, offset = 0) => b.js(`(${EASE}, (() => { const e = ${expr}; const y = typeof e === 'number' ? e : e.getBoundingClientRect().top + scrollY - ${offset}; return __ease(Math.max(0, y), ${ms}); })())`);

async function clip(name, path, act) {
  if (!want(name)) return;
  await b.goto(BASE + path, 6500);
  await b.js("scrollTo(0, 0)");
  const dir = join(FRAMES, name);
  rmSync(dir, { recursive: true, force: true });
  const stop = await b.screencast(dir, { maxWidth: VIEW.w * VIEW.scale, maxHeight: VIEW.h * VIEW.scale });
  mark(`${name}:start`);
  await act();
  mark(`${name}:end`);
  const frames = await stop();
  await b.shot(join(STILLS, `${name}.png`));
  console.log(`${name}: ${frames.length} frames`);
}

await clip("today", "/", async () => {
  await sleep(2600);
  await scrollTo("380", 2600);
  await sleep(1800);
});

await clip("workouts", "/workouts", async () => {
  await sleep(2000);
  await scrollTo("document.querySelector('#cat-legs')", 3400, 70);
  await sleep(1400);
  mark("workouts_pro");
  await scrollTo("document.querySelector('#cat-pro')", 4200, 70);
  await sleep(2600);
});

await clip("setup", "/workout/squat", async () => {
  // The real form guide opens first: "How to do a squat that counts".
  await sleep(2600);
  await scrollTo("[...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === 'Where to put your phone')", 2600, 80);
  await sleep(2200);
  mark("setup_continue");
  await b.click("Got it, continue");
  await sleep(2400);
  await scrollTo("document.querySelector('#setup-tips-heading')", 2400, 90);
  await sleep(2200);
});

await clip("commit", "/commit", async () => {
  await sleep(2400);
  await scrollTo("[...document.querySelectorAll('h2,h3,p')].find((e) => e.textContent.trim() === \"Today's pool\")", 2200, 110);
  await sleep(3400);
});

await clip("you", "/you", async () => {
  await sleep(1800);
  await scrollTo("document.querySelector('#pro-card-title')", 2400, 120);
  await sleep(3400);
});

writeFileSync(marksFile, JSON.stringify(marks, null, 1));
if (b.consoleLines.length) console.log("console:\n" + b.consoleLines.slice(0, 10).join("\n"));
clearTimeout(hardStop);
b.close();
