/** POST /api/attest/chunk {sessionId, chunk} -> ChunkResponse (see lib/attest/protocol). */
import { attestLimiters, handleAttestPost } from "@/lib/attest/http";
import { getAttestService } from "@/lib/attest/service";

export async function POST(request: Request): Promise<Response> {
  const service = getAttestService();
  // base64 chunk data plus a small JSON envelope.
  const maxBytes = service.config.maxChunkChars + 1024;
  return handleAttestPost(request, attestLimiters().chunk, maxBytes, (body) => service.chunk(body));
}
