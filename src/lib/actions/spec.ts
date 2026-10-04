/**
 * Solana Actions (Blinks) wire format and HTTP helpers. Pure: no network, importable anywhere.
 *
 * Spec: https://solana.com/docs/advanced/actions (Actions spec v2.x).
 * - GET  → ActionGetResponse (metadata: icon, title, description, label, links.actions)
 * - POST {account} → ActionPostResponse {type: "transaction", transaction (base64, unsigned,
 *   fee payer = account), message}
 * - OPTIONS → CORS preflight. Every response (including errors) carries the CORS headers plus
 *   X-Action-Version / X-Blockchain-Ids so blink clients (dial.to, wallets) accept it.
 * - errors → 4xx/5xx with ActionError {message} (shown to the user verbatim).
 * - /actions.json at the domain root maps website paths to action API paths.
 */
import type { SolanaCluster } from "@/lib/solana/config";

export const ACTION_VERSION = "2.4";

/** CAIP-2 ids: solana:<first 32 chars of the genesis hash>. */
export const BLOCKCHAIN_IDS: Readonly<Record<SolanaCluster, string>> = Object.freeze({
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
});

export function actionsCorsHeaders(cluster: SolanaCluster): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": ACTION_VERSION,
    "X-Blockchain-Ids": BLOCKCHAIN_IDS[cluster],
  };
}

export type ActionParameterType =
  | "text"
  | "email"
  | "url"
  | "number"
  | "date"
  | "datetime-local"
  | "checkbox"
  | "radio"
  | "textarea"
  | "select";

export interface ActionParameter {
  type?: ActionParameterType;
  name: string;
  label?: string;
  required?: boolean;
  pattern?: string;
  patternDescription?: string;
  min?: string | number;
  max?: string | number;
}

export interface LinkedAction {
  type: "transaction";
  /** Relative hrefs resolve against the action URL's origin. `{name}` is filled from parameters. */
  href: string;
  label: string;
  parameters?: ActionParameter[];
}

export interface ActionError {
  message: string;
}

export interface ActionGetResponse {
  type: "action";
  /** Absolute https URL (SVG, PNG or WebP). */
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: { actions: LinkedAction[] };
  error?: ActionError;
}

export interface ActionPostRequest {
  account: string;
}

export interface ActionPostResponse {
  type: "transaction";
  /** base64 serialized v0 transaction, unsigned, fee payer = the posted account. */
  transaction: string;
  message?: string;
}

export interface ActionsJson {
  rules: Array<{ pathPattern: string; apiPath: string }>;
}

/** Website paths → action endpoints (served at https://fitr.day/actions.json). */
export const ACTIONS_JSON: ActionsJson = Object.freeze({
  rules: [
    { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
  ],
}) as ActionsJson;

/** JSON with the Actions CORS headers. Never cached by intermediaries unless `cache` says so. */
export function actionJson(body: unknown, cluster: SolanaCluster, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...actionsCorsHeaders(cluster),
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
    },
  });
}

export function actionError(message: string, cluster: SolanaCluster, status = 400): Response {
  const body: ActionError = { message };
  return actionJson(body, cluster, status);
}

/** OPTIONS preflight: 204 with the CORS headers. */
export function actionOptions(cluster: SolanaCluster): Response {
  return new Response(null, { status: 204, headers: { ...actionsCorsHeaders(cluster), "cache-control": "public, max-age=86400" } });
}
