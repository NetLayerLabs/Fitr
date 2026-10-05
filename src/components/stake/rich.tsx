import { Fragment, type ReactNode } from "react";

/**
 * Fills a translated template with React nodes: `rich(t("dealDo"), { goal: <strong>…</strong> })`.
 * Placeholders without a node are left as written, so string vars can be passed to `t()` first.
 */
export function rich(template: string, nodes: Readonly<Record<string, ReactNode>>): ReactNode {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    const node = m && m[1] in nodes ? nodes[m[1]] : part;
    return <Fragment key={i}>{node}</Fragment>;
  });
}
