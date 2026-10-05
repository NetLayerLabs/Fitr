import { describe, expect, it } from "vitest";
import { LOCALES } from "../locales";
import { en, loadMessages, type Namespace } from "../messages";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ONLY = process.env.FITR_I18N_LOCALE;

describe.each(LOCALES.filter((l) => l.code !== "en" && (!ONLY || l.code === ONLY)))("$english ($code)", ({ code }) => {
  it("translates every key, keeping every {placeholder}", async () => {
    const messages = await loadMessages(code);
    const missing: string[] = [];
    const broken: string[] = [];
    const extra: string[] = [];
    for (const ns of Object.keys(en) as Namespace[]) {
      const base = en[ns] as Record<string, string>;
      const own = messages[ns] as Record<string, string | undefined>;
      for (const [key, source] of Object.entries(base)) {
        const v = own[key];
        if (typeof v !== "string" || v.trim() === "") missing.push(`${ns}.${key}`);
        else if (placeholders(v).join() !== placeholders(source).join()) broken.push(`${ns}.${key}`);
      }
      for (const key of Object.keys(own)) if (!(key in base) && !/_(zero|one|two|few|many|other)$/.test(key)) extra.push(`${ns}.${key}`);
    }
    expect({ missing: missing.length, broken, extra }).toEqual({ missing: 0, broken: [], extra: [] });
  });
});
