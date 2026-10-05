import type { en } from "./en";

export type Messages = typeof en;
export type Namespace = keyof Messages;
/** One namespace's keys, each a translated string. */
export type NsMessages<N extends Namespace> = { readonly [K in keyof Messages[N]]: string };
/** A language's messages: every namespace, possibly missing keys (they fall back to English). */
export type LocaleMessages = { readonly [N in Namespace]: Partial<NsMessages<N>> };
