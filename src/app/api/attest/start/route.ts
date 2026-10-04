/** POST /api/attest/start {wallet, dayIndex, exercise, goalTarget} -> StartResponse (see lib/attest/protocol). */
import { attestLimiters, handleAttestPost } from "@/lib/attest/http";
import { getAttestService } from "@/lib/attest/service";

export async function POST(request: Request): Promise<Response> {
  return handleAttestPost(request, attestLimiters().start, 2048, (body) => getAttestService().start(body));
}
