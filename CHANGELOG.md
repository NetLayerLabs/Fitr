# Changelog

Fitr has two version numbers: the **Android app** (the APK shell: icon, native bridge, permissions)
and the **web app** it loads from app.fitr.day (all screens and features, updated without a new APK).

## Web 0.5.0 · Android 1.2.0 (build 4)
- **9 languages:** English, Chinese, Japanese, Korean, Italian, Spanish, French, Portuguese and
  German (You → Language). Every screen, the voice coach, errors, reminders and info pages.
- **Android 1.2.0:** the voice coach speaks the chosen language when the phone has a voice for it.
- **Fairer verification:** side-on exercises ask "Raise one hand" (either hand), and left/right
  tracking swaps no longer fail honest workouts. "Verifying" no longer sticks after a rejection.
- **Fitr Pro preview (coming soon):** four locked advanced moves at the end of Workouts and a Pro
  card in You: programs, advanced stats, more crews, paid monthly in SKR with a crew discount.
  Nothing to buy yet; no onchain changes.

## Web 0.4.0 · Android 1.1.0 (build 3)
- **Live on Solana mainnet:** vault program deployed from a reproducible Docker build; program and
  pool owned by a Squads 2-of-3 multisig; 1-hour review window; staking open with real SKR.
- **Sponsored days on:** up to 10 SKR per day from the sponsor reserve to the people who finish;
  sponsor from the app (Commit tab) or the Blink.
- **Delete crew:** the creator removes a crew from the app with a signed message (no transaction);
  its invite link closes, existing stakes stay claimable.
- **Clearer phone placement:** a map from above, the phone's own view and numbered set-up steps.
- **Streak calendar** month by month from October 2026.
- **Landing page:** live hero (looping rep set, parallax, light sweep), section effects, new product tag.
- Fixes: compute budgets for the deployed program (stakes and server verification), crank on the
  local port, technical details under transaction errors; "onchain" spelling everywhere.

## Web 0.3.0 · Android 1.1.0 (build 3)
- **Crews:** group commitments with their own onchain pools, invite links, crew streaks and leaderboards.
- **AI voice coach:** spoken rep counts, milestones, form cues and live-challenge prompts (native Android TTS).
- **Native Android:** daily clock-in reminders, "Fitr — Today" home-screen widget, app shortcuts, App Links.
- **Blinks & sharing:** "Commit with me" and "Sponsor a day" Solana Actions, verified-onchain share cards.
- **Public pool dashboard** at fitr.day/pool; sponsored days in the vault.
- **Android-only app:** fitr.day is the public site; app.fitr.day opens only inside the Fitr app.
- Vault security audit of the crews change: all findings fixed with regression tests.

## Web 0.2.0 · Android 1.0.1 (build 2)
- Official Fitr wordmark, F-mark app icon and favicon; SKR token logo after amounts.
- 16 exercises with categories, athlete photography, mannequin form-guide demos.
- Five-tab redesign (Today · Workouts · Commit · Progress · You), editable profile with photo cropper.
- SKR commitment vault (user-chosen stake and goal), verification server with live challenges.
- fitr.day landing page and APK download; safe VPS deploys.

## Web 0.1.0 · Android 1.0.0 (build 1)
- On-device AI rep counting for push-ups, squats and plank; workout history and streaks; installable app.
