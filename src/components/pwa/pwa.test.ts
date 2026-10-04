import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { EXERCISE_KINDS } from "@/lib/pose/types";
import { PWA_ICONS } from "./iconSet";

describe("web app manifest", () => {
  const m = manifest();

  it("has the install-critical fields", () => {
    expect(m).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      short_name: "Fitr",
      background_color: "#0A0B0D",
      theme_color: "#0A0B0D",
    });
  });

  it("lists 192 + 512 'any' PNGs and a 512 maskable PNG, all served by the icon route", () => {
    const icons = m.icons ?? [];
    const has = (sizes: string, purpose: string) =>
      icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose && icon.type === "image/png");
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
    for (const icon of icons) {
      expect(icon.src.startsWith("/icons/")).toBe(true);
      expect(Object.keys(PWA_ICONS)).toContain(icon.src.slice("/icons/".length));
    }
  });

  it("has a shortcut per exercise", () => {
    expect((m.shortcuts ?? []).map((s) => s.url)).toEqual(EXERCISE_KINDS.map((kind) => `/workout/${kind}`));
  });
});

// ---------------------------------------------------------------------------------------------
// public/sw.js, run in a minimal fake ServiceWorkerGlobalScope.
// ---------------------------------------------------------------------------------------------

const ORIGIN = "https://fitr.test";
const SW_SOURCE = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");

type Handler = (event: FakeEvent) => void;
type FetchImpl = (input: FakeRequest | string) => Promise<Response>;

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  cache: string;
  headers: Headers;
}

interface FakeEvent {
  request?: FakeRequest;
  data?: unknown;
  preloadResponse?: Promise<Response | undefined>;
  waitUntil(promise: Promise<unknown>): void;
  respondWith?(response: Promise<Response> | Response): void;
}

class FakeCache {
  entries: { key: string; response: Response }[] = [];
  private keyOf(input: FakeRequest | string): string {
    return typeof input === "string" ? new URL(input, ORIGIN).href : input.url;
  }
  async put(input: FakeRequest | string, response: Response) {
    const key = this.keyOf(input);
    await response.clone().arrayBuffer();
    this.entries = this.entries.filter((e) => e.key !== key);
    this.entries.push({ key, response });
  }
  async match(input: FakeRequest | string, options: { ignoreSearch?: boolean } = {}) {
    const norm = (href: string) => {
      const url = new URL(href);
      if (options.ignoreSearch) url.search = "";
      return url.href;
    };
    const key = norm(this.keyOf(input));
    return this.entries.find((e) => norm(e.key) === key)?.response.clone();
  }
  async keys() {
    return this.entries.map((e) => ({ url: e.key }));
  }
  async delete(input: FakeRequest | string) {
    const key = this.keyOf(input);
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.key !== key);
    return before !== this.entries.length;
  }
}

function loadWorker(options: { instantTimeouts?: boolean } = {}) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, FakeCache>();
  const state = { skipped: 0, claimed: false, fetchImpl: (async () => { throw new TypeError("offline"); }) as FetchImpl };
  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name)!;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    registration: { navigationPreload: { enable: async () => undefined } },
    clients: { claim: async () => void (state.claimed = true) },
    skipWaiting: async () => void state.skipped++,
    addEventListener: (type: string, handler: Handler) => void (handlers[type] = handler),
  };
  const context = vm.createContext({
    self,
    caches,
    fetch: (input: FakeRequest | string) => state.fetchImpl(input),
    URL,
    Request,
    Response,
    Headers,
    Promise,
    setTimeout: options.instantTimeouts ? (fn: () => void) => fn() : setTimeout,
  });
  vm.runInContext(SW_SOURCE, context);

  async function run(type: string, extra: Partial<FakeEvent> = {}) {
    const waits: Promise<unknown>[] = [];
    const box: { responded: Promise<Response> | null } = { responded: null };
    const event: FakeEvent = {
      preloadResponse: Promise.resolve(undefined),
      ...extra,
      waitUntil: (p) => void waits.push(Promise.resolve(p)),
      respondWith: (r) => void (box.responded = Promise.resolve(r)),
    };
    handlers[type](event);
    const response: Response | null = box.responded ? await box.responded : null;
    let settled = -1;
    while (settled !== waits.length) {
      settled = waits.length;
      await Promise.allSettled(waits);
    }
    return response;
  }

  return { state, stores, caches, run };
}

function req(pathOrUrl: string, init: { mode?: string; method?: string; headers?: Record<string, string> } = {}): FakeRequest {
  return {
    url: new URL(pathOrUrl, ORIGIN).href,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    cache: "default",
    headers: new Headers(init.headers),
  };
}

const html = (marker: string) =>
  new Response(`<html><script src="/_next/static/chunks/app-${marker.length}.js"></script>${marker}</html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
const pathOf = (input: FakeRequest | string) => new URL(typeof input === "string" ? input : input.url, ORIGIN).pathname;
const offline: FetchImpl = async () => {
  throw new TypeError("offline");
};

/** The worker's current shell cache name (it embeds VERSION). */
function shellName(): string {
  const match = /const VERSION = "([^"]+)"/.exec(SW_SOURCE);
  if (!match) throw new Error("VERSION not found in sw.js");
  return `fitr-shell-${match[1]}`;
}

describe("service worker (public/sw.js)", () => {
  it("precaches shell routes individually and survives one failing route", async () => {
    const sw = loadWorker();
    sw.state.fetchImpl = async (input) => {
      const p = pathOf(input);
      if (p === "/history") throw new TypeError("boom");
      if (p.startsWith("/_next/static/")) return new Response("js", { status: 200 });
      return html(p);
    };
    await sw.run("install");
    expect(sw.state.skipped).toBe(1);

    const shellName = [...sw.stores.keys()].find((n) => n.startsWith("fitr-shell-"))!;
    const keys = (await (await sw.caches.open(shellName)).keys()).map((k) => new URL(k.url).pathname).sort();
    expect(keys).toEqual(["/", "/offline", "/workout/plank", "/workout/pushup", "/workout/squat"]);
    // JS referenced by the precached HTML is precached too.
    expect((await (await sw.caches.open("fitr-static-v1")).keys()).length).toBeGreaterThan(0);
  });

  it("activate removes only stale fitr-* caches and claims clients", async () => {
    const sw = loadWorker();
    await sw.caches.open("fitr-shell-old");
    await sw.caches.open("someone-else");
    await sw.run("activate");
    expect(sw.stores.has("fitr-shell-old")).toBe(false);
    expect(sw.stores.has("someone-else")).toBe(true);
    expect(sw.state.claimed).toBe(true);
  });

  it("navigations: network-first, cached copy when offline, then /offline", async () => {
    const sw = loadWorker();
    sw.state.fetchImpl = async (input) => html(pathOf(input));
    await sw.run("fetch", { request: req("/offline", { mode: "navigate" }) });
    await sw.run("fetch", { request: req("/workout/squat", { mode: "navigate" }) });

    sw.state.fetchImpl = offline;
    const cached = await sw.run("fetch", { request: req("/workout/squat?goal=10", { mode: "navigate" }) });
    expect(await cached!.text()).toContain("/workout/squat");
    const fallback = await sw.run("fetch", { request: req("/history", { mode: "navigate" }) });
    expect(await fallback!.text()).toContain("/offline");
  });

  it("navigations: serve the cached copy when the network is too slow", async () => {
    const sw = loadWorker({ instantTimeouts: true });
    sw.state.fetchImpl = async () => html("v1");
    await sw.run("fetch", { request: req("/", { mode: "navigate" }) });
    let release: (r: Response) => void = () => undefined;
    sw.state.fetchImpl = () => new Promise<Response>((resolve) => (release = resolve));
    const pending = sw.run("fetch", { request: req("/", { mode: "navigate" }) });
    await new Promise((r) => setTimeout(r, 10));
    release(html("v2"));
    expect(await (await pending)!.text()).toContain("v1");
  });

  it("navigations: inline 503 page when nothing is cached", async () => {
    const sw = loadWorker();
    const response = await sw.run("fetch", { request: req("/anything", { mode: "navigate" }) });
    expect(response!.status).toBe(503);
  });

  it("cache-first for /mediapipe/**, one copy per path", async () => {
    const sw = loadWorker();
    let calls = 0;
    sw.state.fetchImpl = async () => {
      calls++;
      return new Response("wasm", { status: 200, headers: { "content-type": "application/wasm" } });
    };
    await sw.run("fetch", { request: req("/mediapipe/wasm/x.wasm?v=1", { mode: "cors" }) });
    const hit = await sw.run("fetch", { request: req("/mediapipe/wasm/x.wasm?v=1", { mode: "cors" }) });
    expect(calls).toBe(1);
    expect(hit!.headers.get("content-type")).toBe("application/wasm");
    await sw.run("fetch", { request: req("/mediapipe/wasm/x.wasm?v=2", { mode: "cors" }) });
    const poseCache = [...sw.stores.entries()].find(([n]) => n.startsWith("fitr-pose-"))![1];
    expect(poseCache.entries.map((e) => e.key)).toEqual([`${ORIGIN}/mediapipe/wasm/x.wasm?v=2`]);
  });

  it("never caches 206 or non-CORS remote responses, and ignores what it should not touch", async () => {
    const sw = loadWorker();
    sw.state.fetchImpl = async () => new Response("partial", { status: 206 });
    await sw.run("fetch", { request: req("/mediapipe/models/a.task", { mode: "cors" }) });
    // Node's Response has type "default", i.e. not "cors": must not be stored for a remote URL.
    sw.state.fetchImpl = async () => new Response("model", { status: 200 });
    await sw.run("fetch", {
      request: req("https://storage.googleapis.com/mediapipe-models/pose_landmarker/x.task", { mode: "cors" }),
    });
    const poseCache = [...sw.stores.entries()].find(([n]) => n.startsWith("fitr-pose-"))?.[1];
    expect(poseCache?.entries ?? []).toHaveLength(0);

    const untouched = [
      req("/mediapipe/models/a.task", { headers: { range: "bytes=0-99" } }),
      req("/history", { mode: "cors", method: "POST" }),
      req("/history?_rsc=abc", { mode: "cors", headers: { rsc: "1" } }),
      req("/api/anything", { mode: "cors" }),
      req("/sw.js"),
      req("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm/loader.js", { mode: "no-cors" }),
      req("https://example.com/lib.js", { mode: "cors" }),
    ];
    for (const request of untouched) {
      expect(await sw.run("fetch", { request })).toBeNull();
    }
  });

  it("stale-while-revalidate for icons", async () => {
    const sw = loadWorker();
    let version = 0;
    sw.state.fetchImpl = async () => new Response(`icon${++version}`, { status: 200 });
    const first = await sw.run("fetch", { request: req("/icons/icon-192.png") });
    expect(await first!.text()).toBe("icon1");
    const second = await sw.run("fetch", { request: req("/icons/icon-192.png") });
    expect(await second!.text()).toBe("icon1");
    const third = await sw.run("fetch", { request: req("/icons/icon-192.png") });
    expect(await third!.text()).toBe("icon2");
  });

  it("trims the static cache oldest-first but keeps chunks that cached pages reference", async () => {
    const sw = loadWorker();
    // The cached home page needs the two oldest chunks (runtime + framework) to boot offline.
    const shellCache = await sw.caches.open(shellName());
    await shellCache.put(
      `${ORIGIN}/`,
      new Response('<script src="/_next/static/chunks/runtime.js"></script><link href="/_next/static/chunks/framework.css">', {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const staticCache = await sw.caches.open("fitr-static-v1");
    await staticCache.put(`${ORIGIN}/_next/static/chunks/runtime.js`, new Response("r"));
    await staticCache.put(`${ORIGIN}/_next/static/chunks/framework.css`, new Response("f"));
    for (let i = 0; i < 398; i++) await staticCache.put(`${ORIGIN}/_next/static/chunks/old-${i}.js`, new Response("o"));

    sw.state.fetchImpl = async () => new Response("new", { status: 200 });
    await sw.run("fetch", { request: req("/_next/static/chunks/new-a.js") });
    await sw.run("fetch", { request: req("/_next/static/chunks/new-b.js") });

    const keys = staticCache.entries.map((e) => new URL(e.key).pathname);
    expect(keys).toHaveLength(400);
    expect(keys).toContain("/_next/static/chunks/runtime.js");
    expect(keys).toContain("/_next/static/chunks/framework.css");
    expect(keys).not.toContain("/_next/static/chunks/old-0.js");
    expect(keys).not.toContain("/_next/static/chunks/old-1.js");
    expect(keys).toContain("/_next/static/chunks/old-2.js");
    expect(keys.slice(-2)).toEqual(["/_next/static/chunks/new-a.js", "/_next/static/chunks/new-b.js"]);
  });

  it("honours a SKIP_WAITING message", async () => {
    const sw = loadWorker();
    await sw.run("message", { data: { type: "SKIP_WAITING" } });
    expect(sw.state.skipped).toBe(1);
  });
});
