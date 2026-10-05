/** The app's languages. English is the source; every other language falls back to it per key. */
export const LOCALES = [
  { code: "en", name: "English", english: "English", speech: "en-US" },
  { code: "zh", name: "简体中文", english: "Chinese (Simplified)", speech: "zh-CN" },
  { code: "ja", name: "日本語", english: "Japanese", speech: "ja-JP" },
  { code: "ko", name: "한국어", english: "Korean", speech: "ko-KR" },
  { code: "it", name: "Italiano", english: "Italian", speech: "it-IT" },
  { code: "es", name: "Español", english: "Spanish", speech: "es-ES" },
  { code: "fr", name: "Français", english: "French", speech: "fr-FR" },
  { code: "pt", name: "Português", english: "Portuguese", speech: "pt-BR" },
  { code: "de", name: "Deutsch", english: "German", speech: "de-DE" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
/** Cookie the server reads so it renders the chosen language (no flash, no hydration mismatch). */
export const LOCALE_COOKIE = "fitr_lang";
export const LOCALE_STORAGE_KEY = "fitr.lang.v1";

const CODES = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && CODES.has(v);
}

/** The first supported language in a list of BCP 47 tags (e.g. navigator.languages), else English. */
export function matchLocale(tags: readonly string[] | undefined | null): Locale {
  for (const tag of tags ?? []) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function speechLang(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.speech ?? "en-US";
}
