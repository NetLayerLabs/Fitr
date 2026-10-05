import { Fragment, type ReactNode } from "react";

/**
 * Fills a translated template with React nodes: `rich(t("cameraInsecureText"), { localhost: <code>…</code> })`.
 * Placeholders without a node are left as written, so string vars can be passed to `t()` first.
 */
export function rich(template: string, nodes: Readonly<Record<string, ReactNode>>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in nodes ? nodes[m[1]] : part}</Fragment>;
  });
}
