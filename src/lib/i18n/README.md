# App translations (i18n)

Languages: English (source) + zh, ja, ko, it, es, fr, pt, de (`locales.ts`). The public website
(`src/components/landing`, `src/components/public`, `/c/*`, `/s/*`, `/pool`, Blinks) stays English.

## Where text lives
- `messages/en/<namespace>.ts`: the English source, `{ key: "Text with {placeholder}" } as const`.
- `messages/<locale>/<namespace>.ts`: the same keys translated (`Partial<NsMessages<"ns">>`).
  A missing key falls back to English, never to an empty string.
- Namespaces: common, nav, today, progress, workouts, exercises, guide, workout, voice, stake, crews,
  you, wallet. Add keys to the namespace of the area you own; do not add new namespaces.

## How to use it
- Client components (render): `const t = useT("today"); t("title")`, `t("left", { time })`,
  plurals: `t.plural("days", n)` with keys `days_one` / `days_other` (`{count}` is available).
- Server components: `const t = await getT("you");` (from `@/lib/i18n/server`), also for
  `generateMetadata`.
- Outside render (event handlers, effects, the voice coach, error copy built in a catch):
  `tr("stake", "key", vars)` from `@/lib/i18n`. Never call `tr` during render (server and client
  would disagree).
- Pure helpers that build text during render take a `t` argument (or return keys) instead of
  hard-coding English.

## Rules
- Keys: camelCase, describe the meaning, not the English words (`commitCutoff`, not `commitsCloseAt`).
- Keep placeholders identical across languages; keep `SKR`, `Seeker`, `Solana`, `Fitr`, `Squads`,
  `Seed Vault` untranslated. Write "onchain" in English text.
- Tests run in English (no provider = English), so existing English assertions stay valid.

## Exercise names
Use `src/lib/i18n/exercise.ts` everywhere an exercise name, a goal phrase ("20 push-ups",
"45 seconds of plank") or a category label is shown: `const tx = useT("exercises");
exerciseName(tx, kind)`, `exerciseGoal(tx, kind, n)`, `categoryLabel(tx, id)`. Do not translate
`EXERCISES[kind].name` yourself.
