/** POST /api/attest/finish {sessionId} -> FinishResponse (see lib/attest/protocol). */
import { attestLimiters, handleAttestPost } from "@/lib/attest/http";
import { getAttestService } from "@/lib/attest/service";

export async function POST(request: Request): Promise<Response> {
  return handleAttestPost(request, attestLimiters().finish, 1024, (body) => getAttestService().finish(body));
}
