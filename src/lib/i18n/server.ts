import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";
import { loadMessages, type LocaleMessages, type Namespace } from "./messages";
import { makeTranslator, type Translator } from "./translate";

/** The visitor's language (from the cookie the language picker sets), else English. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getMessages(locale?: Locale): Promise<LocaleMessages> {
  return loadMessages(locale ?? (await getLocale()));
}

/** A translator for server components: `const t = await getT("you")`. */
export async function getT<N extends Namespace>(ns: N): Promise<Translator<N>> {
  const locale = await getLocale();
  return makeTranslator(locale, await loadMessages(locale), ns);
}
