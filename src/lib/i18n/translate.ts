import { DEFAULT_LOCALE, type Locale } from "./locales";
import { en, type LocaleMessages, type Messages, type Namespace } from "./messages";

export type Vars = Readonly<Record<string, string | number>>;

/** Replaces {name} placeholders. Unknown placeholders are left as they are. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The message for `key`, in `messages`' language, else English, else the key itself. */
export function lookup(messages: LocaleMessages, ns: Namespace, key: string): string {
  const own = (messages[ns] as Record<string, string | undefined>)[key];
  if (typeof own === "string" && own.length > 0) return own;
  const base = (en[ns] as Record<string, string | undefined>)[key];
  return typeof base === "string" ? base : key;
}

export interface Translator<N extends Namespace> {
  (key: keyof Messages[N] & string, vars?: Vars): string;
  /**
   * Plural-aware: picks `${key}_one`, `_two`, `_few`, `_many`, `_zero` or `_other` by the locale's
   * plural rules (falling back to `_other`), with {count} available in the template.
   */
  plural(key: string, count: number, vars?: Vars): string;
  locale: Locale;
}

export function makeTranslator<N extends Namespace>(locale: Locale, messages: LocaleMessages, ns: N): Translator<N> {
  const t = ((key: string, vars?: Vars) => interpolate(lookup(messages, ns, key), vars)) as unknown as Translator<N>;
  let rules: Intl.PluralRules | null = null;
  t.plural = (key, count, vars) => {
    rules ??= new Intl.PluralRules(locale);
    const form = rules.select(count);
    const all = { count, ...vars };
    const k = `${key}_${form}`;
    const has = (x: string) =>
      typeof (messages[ns] as Record<string, unknown>)[x] === "string" || typeof (en[ns] as Record<string, unknown>)[x] === "string";
    return interpolate(lookup(messages, ns, has(k) ? k : `${key}_other`), all);
  };
  t.locale = locale;
  return t;
}

// -------------------------------------------------------------------------------------------
// Outside React (event handlers, effects, the voice coach, transaction error copy). Never call
// these during render: render paths use useT() so the server and the client agree.
// -------------------------------------------------------------------------------------------

let active: { locale: Locale; messages: LocaleMessages } = { locale: DEFAULT_LOCALE, messages: en };

/** Called by I18nProvider (client only) whenever the language or its messages change. */
export function setActiveMessages(locale: Locale, messages: LocaleMessages): void {
  active = { locale, messages };
}

export function activeLocale(): Locale {
  return active.locale;
}

/** Translate outside render (see above). */
export function tr<N extends Namespace>(ns: N, key: keyof Messages[N] & string, vars?: Vars): string {
  return interpolate(lookup(active.messages, ns, key), vars);
}
