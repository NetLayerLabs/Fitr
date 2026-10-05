import type { Locale } from "../locales";
import { en } from "./en";
import type { LocaleMessages } from "./types";

export type { LocaleMessages, Messages, Namespace, NsMessages } from "./types";
export { en };

/** English is bundled; other languages load on demand (one chunk each). */
const loaders: Record<Exclude<Locale, "en">, () => Promise<LocaleMessages>> = {
  zh: () => import("./zh").then((m) => m.zh),
  ja: () => import("./ja").then((m) => m.ja),
  ko: () => import("./ko").then((m) => m.ko),
  it: () => import("./it").then((m) => m.it),
  es: () => import("./es").then((m) => m.es),
  fr: () => import("./fr").then((m) => m.fr),
  pt: () => import("./pt").then((m) => m.pt),
  de: () => import("./de").then((m) => m.de),
};

export async function loadMessages(locale: Locale): Promise<LocaleMessages> {
  return locale === "en" ? en : loaders[locale]();
}
