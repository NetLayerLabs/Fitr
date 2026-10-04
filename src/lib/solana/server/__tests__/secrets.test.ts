import { describe, expect, test } from "vitest";
import { parseKeypairBytes, readHeliusApiKey, readServerSecrets, ServerSecretsError } from "../secrets";

const kp = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));

describe("readServerSecrets", () => {
  test("reads all secrets", () => {
    const s = readServerSecrets({ HELIUS_API_KEY: " hk ", ATTESTOR_KEYPAIR: kp, CRON_SECRET: "cs" });
    expect(s.heliusApiKey).toBe("hk");
    expect(s.cronSecret).toBe("cs");
    expect(s.attestorKeypairBytes).toBeInstanceOf(Uint8Array);
    expect(s.attestorKeypairBytes?.length).toBe(64);
    expect(s.attestorKeypairBytes?.[63]).toBe(63);
  });
  test("unset or blank values are null", () => {
    expect(readServerSecrets({ HELIUS_API_KEY: "", ATTESTOR_KEYPAIR: "  " })).toEqual({
      heliusApiKey: null,
      attestorKeypairBytes: null,
      cronSecret: null,
    });
    expect(readHeliusApiKey({})).toBeNull();
  });
  test("a malformed keypair throws without echoing the value", () => {
    for (const bad of ["not json", "[1,2,3]", JSON.stringify(Array(64).fill(256)), JSON.stringify(Array(64).fill(1.5)), "{}"]) {
      let err: unknown;
      try {
        parseKeypairBytes("ATTESTOR_KEYPAIR", bad);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ServerSecretsError);
      expect((err as Error).message).toContain("ATTESTOR_KEYPAIR");
      expect((err as Error).message).not.toContain(bad);
    }
  });
});
