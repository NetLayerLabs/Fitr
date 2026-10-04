/**
 * "Sponsor a day" Blink (Solana Actions). Public on https://fitr.day/api/actions/sponsor
 *   GET  ?pool=          → action metadata
 *   POST ?pool=&amount=  {account} → unsigned fund_reserve transaction (anyone may sponsor)
 */
import { createActionRoute, SPONSOR_ACTION } from "@/lib/actions/routes";

const route = createActionRoute(SPONSOR_ACTION);

export const GET = route.GET;
export const POST = route.POST;
export const OPTIONS = route.OPTIONS;
