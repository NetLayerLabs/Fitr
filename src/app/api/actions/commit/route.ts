/**
 * "Commit with me" Blink (Solana Actions). Public on https://fitr.day/api/actions/commit
 *   GET  ?pool=&exercise=&goal=          → action metadata (stake presets + custom amount)
 *   POST ?pool=&exercise=&goal=&amount=  {account} → unsigned commit transaction (Seeker-only)
 */
import { COMMIT_ACTION, createActionRoute } from "@/lib/actions/routes";

const route = createActionRoute(COMMIT_ACTION);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
