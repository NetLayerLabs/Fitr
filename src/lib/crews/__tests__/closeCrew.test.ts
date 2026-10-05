import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, getAddressFromPublicKey, getBase64Decoder, getUtf8Encoder, signBytes } from "@solana/kit";

vi.mock("server-only", () => ({}));
const invite = vi.hoisted(() => ({ creator: "" }));
vi.mock("@/components/crews/inviteData", () => ({
  loadCrewInvite: async (id: bigint) => (id === 42n ? { kind: "found", crew: { info: { creator: invite.creator } } } : { kind: "missing" }),
}));

import { closeCrewMessage, parseCloseCrewMessage } from "../closeMessage";

const G = globalThis as { __fitrClosedCrews?: unknown };

async function signer() {
  const kp = await generateKeyPair();
  const owner = await getAddressFromPublicKey(kp.publicKey);
  const sign = async (message: string) => getBase64Decoder().decode(await signBytes(kp.privateKey, getUtf8Encoder().encode(message)));
  return { owner, sign };
}

function post(body: unknown) {
  return new Request("https://app.fitr.day/api/crews/closed", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.fitr.day", host: "app.fitr.day", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}

describe("close crew message", () => {
  it("round-trips and rejects anything we would not have produced", () => {
    const owner = "ASGdypRUAb44vhTeSWrbyt11kY8YuL3L8Z8qYMbENtf4";
    const msg = closeCrewMessage(1517347809052257n, owner, Date.UTC(2026, 9, 5, 16));
    expect(parseCloseCrewMessage(msg)).toEqual({ crewId: 1517347809052257n, owner, issuedAtMs: Date.UTC(2026, 9, 5, 16) });
    expect(parseCloseCrewMessage(msg + " ")).toBeNull();
    expect(parseCloseCrewMessage(msg.replace("delete crew 1517", "delete crew 9517"))).not.toBeNull();
    expect(parseCloseCrewMessage("Fitr: delete crew 0\nCreator: x\nIssued at: now\n")).toBeNull();
  });
});

describe("POST /api/crews/closed", () => {
  beforeEach(() => {
    delete G.__fitrClosedCrews;
    process.env.FITR_DATA_DIR = mkdtempSync(path.join(tmpdir(), "fitr-closed-"));
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FITR_DATA_DIR;
  });

  it("closes the crew for its creator, and lists it", async () => {
    const { owner, sign } = await signer();
    invite.creator = owner;
    const { POST, GET } = await import("@/app/api/crews/closed/route");
    const message = closeCrewMessage(42n, owner, Date.now());
    const res = await POST(post({ message, signature: await sign(message) }));
    expect(res.status).toBe(200);
    expect(await (await GET()).json()).toEqual({ closed: ["42"] });
  });

  it("refuses someone who is not the creator, a bad signature and a stale request", async () => {
    const creator = await signer();
    const other = await signer();
    invite.creator = creator.owner;
    const { POST, GET } = await import("@/app/api/crews/closed/route");

    const notCreator = closeCrewMessage(42n, other.owner, Date.now());
    expect((await POST(post({ message: notCreator, signature: await other.sign(notCreator) }))).status).toBe(401);

    const forged = closeCrewMessage(42n, creator.owner, Date.now());
    expect((await POST(post({ message: forged, signature: await other.sign(forged) }))).status).toBe(401);

    const stale = closeCrewMessage(42n, creator.owner, Date.now() - 11 * 60_000);
    expect((await POST(post({ message: stale, signature: await creator.sign(stale) }))).status).toBe(401);

    expect(await (await GET()).json()).toEqual({ closed: [] });
  });
});
