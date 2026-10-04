#!/usr/bin/env node
// Generates the typed @solana/kit client for the fitr-vault Anchor program.
//
//   npm run codegen:vault             copy anchor/target/idl/fitr_vault.json (when present) to
//                                     src/lib/solana/vault/fitr_vault.idl.json, then render the
//                                     Codama JS client into src/lib/solana/vault/generated/
//   npm run codegen:vault -- --no-copy      render from the committed IDL only
//   npm run codegen:vault -- --check        write nothing; exit 1 if the committed IDL differs
//                                           from the anchor build output (when present) or the
//                                           committed generated/ differs from a fresh render
//
// `--from-anchor` is accepted as an explicit alias of the default copy step; it fails when
// the anchor build output is missing. Run `npm run anchor:build` first to refresh the IDL.
//
// syncPackageJson is forced off: its default (true) would rewrite the app's package.json.
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ANCHOR_IDL = path.join(ROOT, "anchor/target/idl/fitr_vault.json");
const APP_IDL = path.join(ROOT, "src/lib/solana/vault/fitr_vault.idl.json");
const GENERATED_REL = "src/lib/solana/vault/generated";
const GENERATED = path.join(ROOT, GENERATED_REL);

const args = new Set(process.argv.slice(2));
const known = new Set(["--check", "--from-anchor", "--no-copy"]);
for (const a of args) {
  if (!known.has(a)) {
    console.error(`codegen-vault: unknown argument ${a} (expected ${[...known].join(", ")})`);
    process.exit(2);
  }
}
const CHECK = args.has("--check");
const FROM_ANCHOR = args.has("--from-anchor");
const NO_COPY = args.has("--no-copy");
if (FROM_ANCHOR && NO_COPY) {
  console.error("codegen-vault: --from-anchor and --no-copy are mutually exclusive");
  process.exit(2);
}

/** Canonical IDL text as committed in the app (2-space JSON + trailing newline). */
function canonicalIdl(file) {
  return JSON.stringify(JSON.parse(readFileSync(file, "utf8")), null, 2) + "\n";
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

async function render(idlText, generatedRel) {
  const codama = createFromRoot(rootNodeFromAnchor(JSON.parse(idlText)));
  await codama.accept(
    renderVisitor(ROOT, {
      generatedFolder: generatedRel,
      kitImportStrategy: "rootOnly",
      syncPackageJson: false,
      deleteFolderBeforeRendering: true,
    }),
  );
}

const haveAnchorIdl = existsSync(ANCHOR_IDL);
if (FROM_ANCHOR && !haveAnchorIdl) {
  console.error(`codegen-vault: ${path.relative(ROOT, ANCHOR_IDL)} not found; run npm run anchor:build first`);
  process.exit(1);
}
const useAnchor = haveAnchorIdl && !NO_COPY;

if (CHECK) {
  const problems = [];
  if (!existsSync(APP_IDL)) {
    console.error(`codegen-vault --check: ${path.relative(ROOT, APP_IDL)} is missing`);
    process.exit(1);
  }
  const committedIdl = readFileSync(APP_IDL, "utf8");
  if (useAnchor && canonicalIdl(ANCHOR_IDL) !== committedIdl) {
    problems.push(`${path.relative(ROOT, APP_IDL)} differs from ${path.relative(ROOT, ANCHOR_IDL)}`);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "fitr-codegen-"));
  try {
    const tmpGen = path.join(tmp, "generated");
    await render(committedIdl, path.relative(ROOT, tmpGen));
    const want = listFiles(tmpGen);
    const have = listFiles(GENERATED);
    for (const f of new Set([...want, ...have])) {
      const a = path.join(tmpGen, f);
      const b = path.join(GENERATED, f);
      if (!existsSync(b)) problems.push(`missing generated file ${f}`);
      else if (!existsSync(a)) problems.push(`stale generated file ${f}`);
      else if (readFileSync(a, "utf8") !== readFileSync(b, "utf8")) problems.push(`out-of-date generated file ${f}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (problems.length) {
    console.error("codegen-vault --check failed; run npm run codegen:vault\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log("codegen-vault --check: IDL and generated client are up to date");
  process.exit(0);
}

if (useAnchor) {
  mkdirSync(path.dirname(APP_IDL), { recursive: true });
  writeFileSync(APP_IDL, canonicalIdl(ANCHOR_IDL));
  console.log(`copied ${path.relative(ROOT, ANCHOR_IDL)} -> ${path.relative(ROOT, APP_IDL)}`);
} else if (!existsSync(APP_IDL)) {
  console.error(`codegen-vault: no IDL (${path.relative(ROOT, APP_IDL)} missing and no anchor build output)`);
  process.exit(1);
}
await render(readFileSync(APP_IDL, "utf8"), GENERATED_REL);
const idl = JSON.parse(readFileSync(APP_IDL, "utf8"));
console.log(
  `rendered ${listFiles(GENERATED).length} files into ${GENERATED_REL} ` +
    `(program ${idl.address}, ${idl.instructions.length} instructions, ${idl.accounts.length} accounts, ${idl.errors.length} errors)`,
);
