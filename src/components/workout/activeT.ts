import { activeLocale, tr, type Namespace, type Translator, type Vars } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n/messages";

/**
 * A full Translator (with plurals) over the app's active language, for code that runs outside
 * render: camera-frame callbacks, the voice coach, error copy built in a catch. Never call it
 * during render (use useT there).
 */
export function activeTranslator<N extends Namespace>(ns: N): Translator<N> {
  type Key = keyof Messages[N] & string;
  const locale = activeLocale();
  const t = ((key: Key, vars?: Vars) => tr(ns, key, vars)) as Translator<N>;
  let rules: Intl.PluralRules | null = null;
  t.plural = (key, count, vars) => {
    rules ??= new Intl.PluralRules(locale);
    const all = { count, ...vars };
    const k = `${key}_${rules.select(count)}`;
    const v = tr(ns, k as Key, all);
    // tr returns the key itself when no language has it: fall back to the `_other` form.
    return v === k ? tr(ns, `${key}_other` as Key, all) : v;
  };
  t.locale = locale;
  return t;
}
