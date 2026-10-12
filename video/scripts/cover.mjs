// Puts the thumbnail at the very start of a finished film, so X and other players show it as the
// cover before play: 0.8 s of the cover, a 0.4 s cross-fade into the film, the audio delayed to
// match, and the cover also embedded as the file's artwork.
//   node scripts/cover.mjs <in.mp4> <cover.png> <out.mp4> <width> <height>
import { execFileSync } from "node:child_process";

const [src, cover, dst, W, H] = process.argv.slice(2);
const HOLD = 0.8, FADE = 0.4;
const fc = [
  `[1:v]scale=${W}:${H},format=yuv420p,fps=30,trim=0:${HOLD + FADE},settb=1/30,setpts=PTS-STARTPTS[c]`,
  `[0:v]format=yuv420p,fps=30,settb=1/30,setpts=PTS-STARTPTS[m]`,
  `[c][m]xfade=transition=fade:duration=${FADE}:offset=${HOLD}[v]`,
  `[0:a]adelay=${Math.round(HOLD * 1000)}|${Math.round(HOLD * 1000)}[a]`,
].join(";");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-loop", "1", "-t", String(HOLD + FADE + 1), "-i", cover, "-i", cover,
  "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-map", "2:v",
  "-c:v:0", "libx264", "-crf", W === "3840" ? "14" : "16", "-preset", "slow", "-pix_fmt", "yuv420p",
  "-c:v:1", "png", "-disposition:v:1", "attached_pic",
  "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", dst]);
console.log(dst);
