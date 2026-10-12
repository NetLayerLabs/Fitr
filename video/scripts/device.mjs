// Brings a Seeker screen recording into the film.
//   node scripts/device.mjs <slot> <file> --segments "14-17.5@1,21-31@2,31-35@1" [--hold 1] [--label "2× speed"] [--audio 0.8]
// slot: commit | workout | claim. Each segment "from-to@speed" (seconds in the source) is kept and
// played at that speed; anything between segments is cut (e.g. the frame Seed Vault blanks while
// signing). --hold freezes the last frame for that many seconds. Output: public/device/<slot>.mp4
// (30 fps H.264, 1080 px wide, gitignored) and an entry in src/device.json. The film plays it at
// 1×, so --label must say when parts were sped up. --audio keeps the phone's own sound (the voice
// coach) at that volume, under the narration.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const [slot, file, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, "")] = rest[i + 1];
if (!["commit", "workout", "claim"].includes(slot) || !file || !opt.segments) {
  console.error('usage: node scripts/device.mjs <commit|workout|claim> <file> --segments "a-b@speed,..." [--hold s] [--label text] [--audio vol]');
  process.exit(1);
}
const segs = opt.segments.split(",").map((s) => {
  const m = s.trim().match(/^([\d.]+)-([\d.]+)@([\d.]+)$/);
  if (!m) throw new Error(`bad segment "${s}"`);
  return { a: +m[1], b: +m[2], k: +m[3] };
});
const src = resolve(file);
const hasAudio = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", src]).toString().trim() !== "";
const tempo = (k) => (k <= 2 ? `atempo=${k}` : `atempo=2,atempo=${k / 2}`);
let fc = segs.map((s, i) =>
  `[0:v]trim=${s.a}:${s.b},setpts=(PTS-STARTPTS)/${s.k},fps=30[v${i}]` +
  (hasAudio ? `;[0:a]atrim=${s.a}:${s.b},asetpts=PTS-STARTPTS,${tempo(s.k)}[a${i}]` : "")).join(";");
fc += `;${segs.map((_, i) => `[v${i}]${hasAudio ? `[a${i}]` : ""}`).join("")}concat=n=${segs.length}:v=1:a=${hasAudio ? 1 : 0}${hasAudio ? "[vc][ac]" : "[vc]"}`;
const hold = Number(opt.hold ?? 0);
fc += `;[vc]scale=1080:-2:flags=lanczos,format=yuv420p${hold ? `,tpad=stop_mode=clone:stop_duration=${hold}` : ""}[vo]`;
if (hasAudio) fc += `;[ac]${hold ? `apad=pad_dur=${hold}` : "anull"}[ao]`;
mkdirSync(join(ROOT, "public/device"), { recursive: true });
const out = `device/${slot}.mp4`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex", fc, "-map", "[vo]", ...(hasAudio ? ["-map", "[ao]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []),
  "-r", "30", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-movflags", "+faststart", join(ROOT, "public", out)]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(ROOT, "public", out)]).toString());
const dj = join(ROOT, "src/device.json");
const dev = JSON.parse(readFileSync(dj, "utf8"));
dev[slot] = { file: out, segments: opt.segments, ...(opt.label ? { speedLabel: opt.label } : {}), ...(opt.audio ? { volume: Number(opt.audio) } : {}), seconds: +dur.toFixed(2) };
writeFileSync(dj, JSON.stringify(dev, null, 2) + "\n");
console.log(`${slot}: ${dur.toFixed(2)}s (${Math.round(dur * 30)} frames) -> public/${out}`);
