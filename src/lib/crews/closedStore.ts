import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Crews their creator deleted from the app (see closeMessage.ts). One small JSON file in
 * FITR_DATA_DIR (/opt/fitr/data on the VPS, outside the release folder so deploys keep it); held
 * in memory after the first read. Without FITR_DATA_DIR (development) it lives in memory only.
 */
export interface ClosedCrew {
  closedAt: number;
  by: string;
}

const FILE = "closed-crews.json";
const G = globalThis as typeof globalThis & { __fitrClosedCrews?: Promise<Map<string, ClosedCrew>> };

function dataDir(): string | null {
  const dir = process.env.FITR_DATA_DIR?.trim();
  return dir ? dir : null;
}

async function load(): Promise<Map<string, ClosedCrew>> {
  const dir = dataDir();
  if (!dir) return new Map();
  try {
    const raw = JSON.parse(await readFile(path.join(dir, FILE), "utf8")) as Record<string, ClosedCrew>;
    return new Map(Object.entries(raw).filter(([id, v]) => /^[1-9][0-9]{0,19}$/.test(id) && typeof v?.closedAt === "number"));
  } catch {
    return new Map();
  }
}

function store(): Promise<Map<string, ClosedCrew>> {
  return (G.__fitrClosedCrews ??= load());
}

export async function closedCrewIds(): Promise<string[]> {
  return [...(await store()).keys()];
}

export async function isCrewClosed(crewId: bigint): Promise<boolean> {
  return (await store()).has(crewId.toString());
}

/** Records the crew as closed (idempotent) and persists the whole list atomically. */
export async function markCrewClosed(crewId: bigint, by: string, now = Date.now()): Promise<void> {
  const map = await store();
  const key = crewId.toString();
  if (map.has(key)) return;
  map.set(key, { closedAt: now, by });
  const dir = dataDir();
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${FILE}.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(Object.fromEntries(map)), { mode: 0o640 });
  await rename(tmp, path.join(dir, FILE));
}
