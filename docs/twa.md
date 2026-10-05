> **SUPERSEDED (2026-10-04).** Fitr no longer ships as a Bubblewrap TWA. The Android app is a
> Solana Mobile **WebView shell** (`android/fitr-shell`, application id `day.fitr`, URL
> `https://fitr.day`) with a camera-permission patch, because MWA wallet hand-off and in-app camera
> need native control a TWA does not give us. Use **[docs/android.md](android.md)** to build, and
> **[docs/deploy.md](deploy.md)** to host the site. The text below is kept only for history; its package
> id (`app.fitr.twa`) and origin (`fitr.app`) are obsolete.

# Packaging Fitr as an Android app (TWA) and submitting to the Solana dApp Store

Fitr ships as a PWA. For Android we wrap the **deployed** site in a Trusted Web Activity (TWA)
with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). The APK is a thin launcher: the
UI, pose model and service worker all come from the website, so web deploys update the app without
a new APK. You only rebuild the APK to change the package metadata, icons or signing.

Anything marked **UNVERIFIED** was written from memory of the tools' documentation and was not run
while writing this guide. Check it against the current docs before relying on it.

## What the web app already provides

| Requirement | Where |
| --- | --- |
| Manifest at `/manifest.webmanifest` (`id`/`start_url`/`scope` = `/`, standalone, portrait, `#0A0B0D`) | `src/app/manifest.ts` |
| PNG icons: `/icons/icon-192.png`, `/icons/icon-512.png` (any), `/icons/maskable-512.png` (maskable) | `src/app/icons/[name]/route.tsx`, prerendered at build time |
| Service worker at `/sw.js` (offline shell, cached pose model) | `public/sw.js` |
| Digital Asset Links at `/.well-known/assetlinks.json` (placeholder) | `public/.well-known/assetlinks.json` |
| Headers for the three above | `next.config.ts` |

## 0. Prerequisites

- The site deployed on its **final HTTPS origin** (e.g. `https://fitr.app`). Package id and origin are
  tied together by Digital Asset Links, so don't package a preview URL you'll throw away.
- Node 20+ and `npm i -g @bubblewrap/cli`. On first run Bubblewrap offers to download a JDK and the
  Android SDK for you; `bubblewrap doctor` checks the setup. (UNVERIFIED: the exact JDK version it
  pins.)
- An Android device with USB debugging on, ideally a Solana Seeker.

Check before packaging:

```bash
curl -sI https://fitr.app/manifest.webmanifest | grep -i content-type
curl -sI https://fitr.app/icons/maskable-512.png | grep -i content-type    # image/png
curl -s  https://fitr.app/.well-known/assetlinks.json                       # must not redirect
```

## 1. Create the Android project

```bash
mkdir fitr-twa && cd fitr-twa          # keep it outside this repo, or git-ignore the keystore
bubblewrap init --manifest=https://fitr.app/manifest.webmanifest
```

Bubblewrap reads the manifest and asks to confirm each value. Use:

| Prompt | Value |
| --- | --- |
| Domain / start URL | `fitr.app` / `/` |
| Application name / launcher name | `Fitr — Proof of Workout` / `Fitr` |
| Display mode / orientation | `standalone` / `portrait` |
| Theme, navigation and background colour | `#0A0B0D` |
| Icon URL | `https://fitr.app/icons/icon-512.png` |
| Maskable icon URL | `https://fitr.app/icons/maskable-512.png` |
| Package ID (Application ID) | `app.fitr.twa`, which must match `assetlinks.json` |
| Notifications / location delegation | No (M1 needs neither) |
| Signing key | Create a new one, or point at an existing keystore (see step 2) |

This writes `twa-manifest.json` (the source of truth for later rebuilds) plus a Gradle project. For
later changes, edit `twa-manifest.json`, bump `appVersionCode`, then run `bubblewrap update`.

**Fallback browser (important on Seeker, UNVERIFIED).** A TWA needs a browser that supports TWAs
(Chrome and some other Chromium browsers). If none is installed, Bubblewrap's `fallbackType`
(`customtabs` or `webview`) decides what happens. A WebView fallback is a different runtime from
Chrome: separate storage, and its own handling of camera permissions. It probably doesn't support
Mobile Wallet Adapter either, which is a Milestone 2 concern. Confirm which browser Seeker ships with
and test the fallback path on a real device.

## 2. Signing key

The dApp Store requires an APK signed with **your own** release key, and its docs say not to reuse a
Google Play signing key (UNVERIFIED wording, but assume it). If you let `bubblewrap init` create the
key, it writes `android.keystore` with alias `android`. Or create one yourself:

```bash
keytool -genkeypair -v -keystore fitr-release.keystore -alias fitr \
  -keyalg RSA -keysize 2048 -validity 10000
```

Back up the keystore and both passwords somewhere safe (a password manager, not git).
**Losing the key means you can never ship an update to the same listing.**

## 3. Put the fingerprint in `assetlinks.json`

```bash
keytool -list -v -keystore fitr-release.keystore -alias fitr | grep 'SHA256:'
# SHA256: AB:CD:...:EF   (32 colon-separated hex bytes)
```

Replace `REPLACE_WITH_RELEASE_SIGNING_KEY_SHA256` in `public/.well-known/assetlinks.json` with that
value (keep the colons), commit, and **deploy the website**. You can list several fingerprints (e.g.
a debug key too). Bubblewrap can also generate the file:
`bubblewrap fingerprint add <SHA256>` then `bubblewrap fingerprint generateAssetLinks` (UNVERIFIED
subcommand names; see `bubblewrap help`).

Verify with Google's Digital Asset Links API:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://fitr.app&relation=delegate_permission/common.handle_all_urls
```

If verification fails, the app still opens but shows a browser URL bar (Custom Tab mode). That's
the usual symptom of a wrong fingerprint, package id, redirect, or wrong `Content-Type`.

## 4. Build

```bash
bubblewrap build
# -> app-release-signed.apk   (sideload / dApp Store)
# -> app-release-bundle.aab   (Google Play only)
```

## 5. Test on a device

```bash
bubblewrap install            # or: adb install -r app-release-signed.apk
```

Checklist:

- Launches full-screen with no URL bar (so Asset Links are verified). The splash screen is `#0A0B0D`
  with the Fitr icon.
- The camera permission prompt appears on a workout screen, and pose tracking runs at a usable FPS.
- Kill the network after one workout: the app still opens (service worker shell) and the workout
  screen loads the cached pose model.
- The long-press launcher icon shows the Push-ups / Squats / Plank shortcuts.
- The adaptive icon isn't clipped in circle, squircle or teardrop masks.

Debug the web layer via `chrome://inspect` on a desktop Chrome with the device attached.

## 6. Submit to the Solana dApp Store (UNVERIFIED: the process changes often)

Read the current guide at <https://docs.solanamobile.com> (dApp publishing section; it has a
PWA-via-Bubblewrap page) before submitting. As of the last known process:

1. **Publisher portal / CLI.** Publishing happens either through the Solana Mobile publisher portal
   or the `@solana-mobile/dapp-store-cli` (`npx dapp-store init`, then `create publisher`,
   `create app`, `create release`, `publish submit`). Either way, the publisher, app and each release
   are recorded onchain as NFTs. That needs a Solana keypair funded with a little SOL, and the media
   gets uploaded to decentralized storage.
2. **Assets:** the signed release APK from step 4, a 512×512 icon (reuse
   `https://fitr.app/icons/icon-512.png`), a banner (1200×600 was required), several phone
   screenshots, a short and long description, and privacy policy, license and copyright URLs.
3. **Release checks:** the APK's package id (`app.fitr.twa`) and signing certificate must stay the
   same across releases. Bump `appVersionCode` for every new APK.
4. **Review:** submissions are reviewed against the dApp Store publisher policy. For the Solana
   Mobile hackathon, check the hackathon's own submission requirements too (demo video, repo link).

## Notes and trade-offs

- **Not a static export.** `output: "export"` would drop the `headers()` config that `/sw.js`,
  `/mediapipe/**` and `assetlinks.json` depend on. Deploy with `next build && next start` or a
  platform that runs Next (e.g. Vercel). A TWA needs a live HTTPS origin anyway.
- **Updating the web app** needs no new APK. Update `twa-manifest.json` and rebuild only for name,
  icon, colour, package or signing changes.
- **Service worker updates** activate immediately (see the header comment in `public/sw.js`). Bump
  `VERSION` there when you change caching logic or the shell route list. Bump
  `POSE_ASSETS_VERSION` when `@mediapipe/tasks-vision` or the model files change.
