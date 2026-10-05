/**
 * Mainnet admin steps for the fitr-vault global pool (anchor/MAINNET_RUNBOOK.md §5, §7, §8).
 *
 *   npx tsx scripts/solana/vault-admin.ts status
 *   npx tsx scripts/solana/vault-admin.ts init      [--send]   §5: initialize_pool + pause, one tx
 *   npx tsx scripts/solana/vault-admin.ts propose   [--send]   §7.1: propose_authority(SQUADS_VAULT)
 *   npx tsx scripts/solana/vault-admin.ts accept-tx            §7.2: base58 tx for Squads "import"
 *
 * Without --send every step only simulates. Env: HELIUS_API_KEY (from .env.local), DEPLOYER_KEYPAIR
 * (path, default ~/.fitr/keys/fitr-deployer.json), ATTESTOR, SQUADS_VAULT.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import {
  fetchMaybePool,
  findPoolPda,
  findVaultPda,
  getAcceptAuthorityInstruction,
  getInitializePoolInstructionAsync,
  getProposeAuthorityInstruction,
  getUpdateConfigInstruction,
  FITR_VAULT_PROGRAM_ADDRESS,
} from "../../src/lib/solana/vault/generated";

const SKR = address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/** SPEC §9 / runbook §5 values. Goal limits mirror EXERCISES[*].minGoal (src/lib/exercises.ts). */
const PARAMS = {
  minStake: 1_000_000n, // 1 SKR
  maxStake: 10_000_000_000n, // 10,000 SKR
  feeBps: 500,
  streakBonusBps: 500,
  maxStreakBonusBps: 5000,
  dayLengthSecs: 86_400n, // IMMUTABLE
  dayOffsetSecs: 0n, // IMMUTABLE: 00:00 UTC
  commitCutoffSecs: 64_800n,
  attestGraceSecs: 3_600n,
  goalLimits: [
    { min: 10, max: 1000 }, //  0 Pushup
    { min: 15, max: 1000 }, //  1 Squat
    { min: 30, max: 3600 }, //  2 Plank (s)
    { min: 10, max: 1000 }, //  3 Lunge
    { min: 10, max: 1000 }, //  4 Situp
    { min: 10, max: 1000 }, //  5 LegRaise
    { min: 10, max: 1000 }, //  6 GluteBridge
    { min: 30, max: 3600 }, //  7 WallSit (s)
    { min: 5, max: 1000 }, //  8 PikePushup
    { min: 10, max: 1000 }, //  9 JumpSquat
    { min: 3, max: 1000 }, // 10 Pullup
    { min: 5, max: 1000 }, // 11 Dip
    { min: 5, max: 1000 }, // 12 Burpee
    { min: 20, max: 3000 }, // 13 MountainClimber
    { min: 20, max: 3000 }, // 14 JumpingJack
    { min: 20, max: 3000 }, // 15 HighKnees
  ],
  dailySponsorAmount: 0n,
  requireSgt: true,
  finalizeDelaySecs: 3_600n, // 1 h review window (founder's choice, 2026-10-05)
} as const;

const NONE = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function rpcUrl(): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  const file = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const key = /^HELIUS_API_KEY=(.+)$/m.exec(file)?.[1]?.trim() || process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY not found");
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

async function deployer(): Promise<TransactionSigner> {
  const path = process.env.DEPLOYER_KEYPAIR ?? `${homedir()}/.fitr/keys/fitr-deployer.json`;
  return createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

const rpc = createSolanaRpc(rpcUrl());

async function addresses() {
  const [pool] = await findPoolPda({ mint: SKR, crewId: 0n });
  const [vault] = await findVaultPda({ pool });
  return { pool, vault };
}

async function run(signer: TransactionSigner, ixs: Instruction[], send: boolean) {
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) =>
      appendTransactionMessageInstructions(
        [getSetComputeUnitLimitInstruction({ units: 400_000 }), getSetComputeUnitPriceInstruction({ microLamports: 50_000n }), ...ixs],
        m,
      ),
  );
  const tx = await signTransactionMessageWithSigners(message);
  const wire = getBase64EncodedWireTransaction(tx);
  const sim = await rpc
    .simulateTransaction(wire, { encoding: "base64", commitment: "confirmed", replaceRecentBlockhash: false, sigVerify: true })
    .send();
  console.log("simulation:", sim.value.err ? JSON.stringify(sim.value.err, (_, v) => (typeof v === "bigint" ? String(v) : v)) : "ok", `(${sim.value.unitsConsumed} CU)`);
  for (const line of sim.value.logs ?? []) if (/Program log|failed|error/i.test(line)) console.log("  ", line);
  if (sim.value.err) throw new Error("simulation failed; nothing sent");
  if (!send) {
    console.log("dry run: not sent (add --send)");
    return;
  }
  const sig = getSignatureFromTransaction(tx);
  await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true, maxRetries: 0n }).send();
  console.log("sent:", sig);
  for (let i = 0; i < 90; i++) {
    const { value } = await rpc.getSignatureStatuses([sig]).send();
    const s = value[0];
    if (s?.err) throw new Error(`failed: ${JSON.stringify(s.err)}`);
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      console.log("confirmed:", sig);
      return;
    }
    if (i % 5 === 4) await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true, maxRetries: 0n }).send().catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`not confirmed in time: ${sig} (check before retrying)`);
}

async function status() {
  const { pool, vault } = await addresses();
  console.log("program:", FITR_VAULT_PROGRAM_ADDRESS, "\npool:", pool, "\nvault:", vault);
  const acc = await fetchMaybePool(rpc, pool);
  if (!acc.exists) return console.log("pool: not initialized");
  console.log(JSON.stringify(acc.data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 1));
}

async function init(send: boolean) {
  const signer = await deployer();
  const attestor = address(env("ATTESTOR"));
  const { pool } = await addresses();
  const initIx = await getInitializePoolInstructionAsync({ authority: signer, mint: SKR, tokenProgram: TOKEN_PROGRAM, attestor, ...PARAMS, goalLimits: [...PARAMS.goalLimits] });
  const pauseIx = getUpdateConfigInstruction({
    authority: signer,
    pool,
    attestor: NONE,
    minStake: NONE,
    maxStake: NONE,
    feeBps: NONE,
    streakBonusBps: NONE,
    maxStreakBonusBps: NONE,
    commitCutoffSecs: NONE,
    attestGraceSecs: NONE,
    goalLimits: NONE,
    dailySponsorAmount: NONE,
    paused: true,
    requireSgt: NONE,
    finalizeDelaySecs: NONE,
  });
  await run(signer, [initIx, pauseIx], send);
}

async function propose(send: boolean) {
  const signer = await deployer();
  const { pool } = await addresses();
  await run(signer, [getProposeAuthorityInstruction({ authority: signer, pool, newAuthority: address(env("SQUADS_VAULT")) })], send);
}

/** A v0 message paid by the Squads vault, base58, for Squads → Developers → TX Builder → Import. */
async function acceptTx() {
  const squads: Address = address(env("SQUADS_VAULT"));
  const { pool } = await addresses();
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const noop = { address: squads } as unknown as TransactionSigner;
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(squads, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([getAcceptAuthorityInstruction({ newAuthority: noop, pool })], m),
  );
  const compiled = compileTransaction(message);
  console.log(getBase58Decoder().decode(compiled.messageBytes));
}

const [cmd, flag] = process.argv.slice(2);
const send = flag === "--send";
const steps: Record<string, () => Promise<unknown>> = { status, init: () => init(send), propose: () => propose(send), "accept-tx": acceptTx };
if (!steps[cmd]) {
  console.error("usage: vault-admin.ts status | init [--send] | propose [--send] | accept-tx");
  process.exit(1);
}
steps[cmd]().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
