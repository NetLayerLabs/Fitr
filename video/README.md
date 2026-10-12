# Fitr demo film

A 2:59 product film for the CLOCK IN Solana Mobile hackathon, built with Remotion 4.
Watch it: https://www.youtube.com/watch?v=v1F4vOIn1PI
It is its own package: the app's TypeScript, lint and deploy all exclude `video/`.

## What is real

- **Numbers and sources.**
  - 4.3 visits a month and over $17 a visit, with a $10 pass on offer: DellaVigna & Malmendier, *American Economic Review*, 2006.
  - Losses weigh about twice as much as gains: Tversky & Kahneman, 1992.
  - Commitment contracts help people keep promises: Giné, Karlan & Zinman, *AEJ: Applied*, 2010.
  - These are the same citations as the README's problem table.
- **The onchain record (scene 08)** is Fitr's first verified day, read from Solana mainnet:
  - transaction `37kSAsEQH9uttfqwuB1YPncEJa9okipEH79dFQqjDe4QAHTw9GMvowi7MmApJnWmzFGMUpKjhcq1GMhCSTeXU7uw`;
  - instruction `AttestCompletion`, success;
  - slot 455,478,918, 2026-10-11 02:02 UTC;
  - 43,775 compute units;
  - day 20737, 16 of 15 squats.
- **Vault facts (scenes 05, 09, 10 and 11)** come from the deployed program and README:
  - the day's rules: commits close at 18:00 UTC, a grace hour, a one-hour review window, settlement at 02:00;
  - the Squads 2-of-3 address and the verifiable-build hash;
  - 79 program tests, and a fuzz of 256 scenarios and about 31,000 transactions;
  - the 5% fee on forfeits only, and the 10 SKR a day sponsor bonus.
- **App footage** (Today, Workouts, the squat form guide and setup, Commit with the live pool, You with Fitr Pro):
  - recorded by `scripts/capture.mjs` from the live app at app.fitr.day, with mainnet data;
  - phone size 390×844 at 3×, so frames are 1170×2532;
  - nothing in it is mocked.
- **Seeker footage** (commit, workout, live check, reps, goal and claim):
  - real screen recordings from a Seeker, added with `scripts/device.mjs`;
  - a sped-up clip carries an on-screen label (for example "2× speed");
  - until a clip is added, the scene plays app footage marked "PLACEHOLDER".
  - The claim shown is the 5 SKR stake verified on 11 Oct, claimed on 12 Oct for 15 SKR (5 SKR stake plus the 10 SKR daily sponsor bonus, transaction `618CCqBuxb7gBF4FwNiYXV91fUqj9Q4RKKTTAnbmJVKfUnxegVr4yHpcgcCFbQQSDPb43yHRT19wmUyJvTyLvD9M`).
  - The commit and the workout are a new, identical stake on 12 Oct: 15 squats, 5 SKR. The workout reached 16 of 15 reps and was verified onchain. Its live check ("Raise one hand above your head") is the real, random one from that run.
  - Cuts and speed: setup steps in commit and claim run at 2×, the middle reps at 3×; the live check, goal reached and verification play at real speed. Each phone carries a speed tag.
  - The Seed Vault signing screen blanks itself for 0.3 s during the screen recording (a security feature); that frame was cut.
- **Motion graphics**, which illustrate rather than record:
  - the pose lines, traced by hand from the athlete photos (`public/art`, the app's own art);
  - the rep counter in "What the AI sees";
  - the 24-hour day dial.
  - They are labelled "illustration" where they could be mistaken for app output.
- **Audio:**
  - the narration is ElevenLabs (Brian, `eleven_multilingual_v2`);
  - the music is the ElevenLabs Music API;
  - the sound effects are ElevenLabs sound generation.

## Build it

```bash
cd video && npm install
node scripts/voiceover.mjs        # narration (needs ELEVENLABS_API_KEY; read at runtime, never stored)
node scripts/sfx.mjs              # sound effects
node scripts/music.mjs            # score
node scripts/timing.mjs           # src/timing.json: every word on a frame
node scripts/capture.mjs && node scripts/encode.mjs   # live app footage
node scripts/device.mjs commit ~/Downloads/commit.MOV --segments "2-14.75@2,15.15-19@2,19-25.5@1" --hold 1.2 --label "parts at 2× speed"
node scripts/device.mjs claim ~/Downloads/reward_claim.MOV --segments "14-17.5@1,21-31@2,31-35@1" --hold 1.5 --label "parts at 2× speed"
node scripts/device.mjs workout ~/Downloads/full_workout.MOV --segments "3.6-14@1,14-22.5@1,22.5-54.5@3,54.5-61.5@1,64-66@1" --hold 1 --label "reps at 3× speed"
node scripts/stills.mjs 259 641 966 && node scripts/sheet.mjs 259 641 966   # check frames
npx remotion render Fitr out/draft.mp4 --scale 0.5 --crf 28                 # draft
npm run render4k && node scripts/finish.mjs out/fitr-demo-4k-raw.mp4 out/fitr-demo-4k.mp4
ffmpeg -i out/fitr-demo-4k.mp4 -vf scale=1920:1080:flags=lanczos -c:v libx264 -crf 16 -preset slow -c:a copy out/fitr-demo-1080p.mp4
npm run poster
node scripts/cover.mjs out/fitr-demo-4k.mp4 out/fitr-thumbnail-4k.png out/fitr-demo-4k-cover.mp4 3840 2160   # cover as first frame
```
