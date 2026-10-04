/**
 * https://fitr.day/actions.json: maps website paths to Fitr's Solana Action endpoints so Blink
 * clients can unfurl them. Must be served at the domain root with the Actions CORS headers.
 */
import { ACTIONS_JSON, actionJson, actionOptions } from "@/lib/actions/spec";
import { solanaConfig } from "@/lib/solana/config";

export const dynamic = "force-static";

export function GET(): Response {
  return actionJson(ACTIONS_JSON, solanaConfig.cluster, 200, "public, max-age=3600");
}

export function OPTIONS(): Response {
  return actionOptions(solanaConfig.cluster);
}
