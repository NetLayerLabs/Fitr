import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export type CardTone = "default" | "elevated" | "lime";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  /** default = surface + hairline; elevated = raised surface + shadow; lime = accent block. */
  tone?: CardTone;
  padding?: "md" | "lg";
  children: ReactNode;
}

/** Rounded content block. Pass aria-labelledby / aria-label when rendering as a section. */
export default function Card({
  as: Tag = "div",
  tone = "default",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [styles.card, styles[tone], styles[padding], className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} data-tone={tone} {...rest}>
      {children}
    </Tag>
  );
}
