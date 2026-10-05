"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from "./locales";
import { en as ENGLISH, loadMessages, type LocaleMessages, type Namespace } from "./messages";
import { makeTranslator, setActiveMessages, type Translator } from "./translate";

interface I18nState {
  locale: Locale;
  messages: LocaleMessages;
  setLocale: (locale: Locale) => Promise<void>;
}

const I18nContext = createContext<I18nState | null>(null);

/**
 * Holds the app's language. The server renders with the language from the `fitr_lang` cookie and
 * passes that language's messages in, so the first paint is already translated. Switching loads
 * the new messages, stores the choice (cookie + localStorage) and refreshes server components.
 */
export default function I18nProvider({
  locale: initialLocale,
  messages: initialMessages,
  children,
}: {
  locale: Locale;
  messages: LocaleMessages;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState({ locale: initialLocale, messages: initialMessages });
  if (typeof window !== "undefined") setActiveMessages(state.locale, state.messages);

  const setLocale = useCallback(
    async (locale: Locale) => {
      const messages = await loadMessages(locale);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        // The cookie below still carries the choice.
      }
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax; secure`;
      document.documentElement.lang = locale;
      setActiveMessages(locale, messages);
      setState({ locale, messages });
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ ...state, setLocale }), [state, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const FALLBACK: I18nState = {
  locale: "en",
  messages: null as unknown as LocaleMessages,
  setLocale: async () => {},
};

function useI18n(): I18nState {
  return useContext(I18nContext) ?? FALLBACK;
}

/** The current language and a way to change it. */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => Promise<void> } {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}

/**
 * A translator for one namespace: `const t = useT("today"); t("title", { name })`.
 * Outside a provider (tests, isolated renders) it translates to English.
 */
export function useT<N extends Namespace>(ns: N): Translator<N> {
  const { locale, messages } = useI18n();
  return useMemo(() => makeTranslator(locale, messages ?? ENGLISH, ns), [locale, messages, ns]);
}

