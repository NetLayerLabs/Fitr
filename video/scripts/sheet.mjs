// Tiles out/stills/f<frame>.png (the given frames, in order) into out/stills/sheet.png, 3 across.
//   node scripts/sheet.mjs 120 480 960 ...
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const frames = process.argv.slice(2);
const inputs = frames.flatMap((f) => ["-i", join(ROOT, "out/stills", `f${f}.png`)]);
const n = frames.length;
const W = 640, H = 360, cols = 3;
const scale = frames.map((_, i) => `[${i}]scale=${W}:${H}[s${i}]`).join(";");
const layout = frames.map((_, i) => `${(i % cols) * W}_${Math.floor(i / cols) * H}`).join("|");
const fc = n === 1 ? `${scale}` : `${scale};${frames.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${n}:layout=${layout}:fill=black[o]`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", fc, "-map", n === 1 ? "[s0]" : "[o]", join(ROOT, "out/stills/sheet.png")]);
console.log(join(ROOT, "out/stills/sheet.png"));
