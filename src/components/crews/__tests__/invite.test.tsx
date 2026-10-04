// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { encodeCrewName } from "@/lib/solana/vault/crews";
import { Exercise } from "@/lib/solana/vault/generated";
import { D0, MINT, T0, USER } from "@/lib/solana/vault/__tests__/fixtures";
import CrewInvitePage from "../CrewInvitePage";
import { readCrewInvite } from "../inviteData";
import { FakeChain, PROGRAM } from "./fakeChain";

const OTHER = address("Vote111111111111111111111111111111111111111");

afterEach(cleanup);

describe("readCrewInvite", () => {
  it("reads the crew, its member count and today's commits", async () => {
    const c = new FakeChain();
    await c.pool(0n);
    const crew = await c.pool(21n, { name: encodeCrewName("Run Club"), hasFixedExercise: true, fixedExercise: Exercise.Pushup, fixedGoalTarget: 25 });
    await c.profile(crew, USER);
    await c.profile(crew, OTHER);
    await c.day(crew, D0, { committedCount: 2 });
    const res = await readCrewInvite(c.rpc(), 21n, { mint: MINT, programAddress: PROGRAM, nowSecs: T0 + 100 });
    expect(res.kind).toBe("found");
    if (res.kind !== "found") return;
    expect(res.crew).toMatchObject({ name: "Run Club", challenge: "25 push-ups for everyone", members: 2, committedToday: 2 });
  });

  it("missing crew, and the global pool is never an invite", async () => {
    const c = new FakeChain();
    await c.pool(0n);
    expect((await readCrewInvite(c.rpc(), 22n, { mint: MINT, programAddress: PROGRAM, nowSecs: T0 })).kind).toBe("missing");
  });

  it("before the vault opens (no global pool either) it says so instead of 'missing'", async () => {
    const c = new FakeChain();
    expect((await readCrewInvite(c.rpc(), 22n, { mint: MINT, programAddress: PROGRAM, nowSecs: T0 })).kind).toBe("no_pool");
  });

  it("still shows the crew when the member count cannot be read", async () => {
    const c = new FakeChain();
    await c.pool(23n, { name: encodeCrewName("Quiet") });
    c.failProgramAccounts = true;
    const res = await readCrewInvite(c.rpc(), 23n, { mint: MINT, programAddress: PROGRAM, nowSecs: T0 });
    expect(res).toMatchObject({ kind: "found", crew: { name: "Quiet", members: 0 } });
  });
});

describe("CrewInvitePage", () => {
  it("shows the crew with the download and open-in-app links", async () => {
    const c = new FakeChain();
    await c.pool(21n, { name: encodeCrewName("Run Club") });
    const res = await readCrewInvite(c.rpc(), 21n, { mint: MINT, programAddress: PROGRAM, nowSecs: T0 });
    render(<CrewInvitePage crewId={21n} result={res} />);
    expect(screen.getByRole("heading", { level: 1, name: "Join Run Club" })).toBeTruthy();
    expect(screen.getByText("Everyone picks their own workout")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download Fitr to join" }).getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
    expect(screen.getByRole("link", { name: "Open in Fitr" }).getAttribute("href")).toBe("https://app.fitr.day/crew/21");
    // Commitment framing, never "earn".
    expect(document.body.textContent).not.toMatch(/\bearn/i);
  });

  it("a generic invite when the chain cannot be read, and a clear message for a missing crew", () => {
    const { unmount } = render(<CrewInvitePage crewId={5n} result={{ kind: "unavailable" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Join a crew on Fitr" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open in Fitr" }).getAttribute("href")).toBe("https://app.fitr.day/crew/5");
    unmount();
    render(<CrewInvitePage crewId={5n} result={{ kind: "missing" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "This crew doesn't exist" })).toBeTruthy();
  });

  it("an 'opens with the vault' page before staking is live", () => {
    render(<CrewInvitePage crewId={5n} result={{ kind: "no_pool" }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Crews open with the vault" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download Fitr" }).getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
    expect(document.body.textContent).not.toMatch(/\bearn/i);
  });
});
