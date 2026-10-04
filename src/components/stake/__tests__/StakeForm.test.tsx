// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { D0, makePool } from "@/lib/solana/vault/__tests__/fixtures";
import StakeForm, { formatFeePercent, type StakeFormProps } from "../StakeForm";

afterEach(cleanup);

const SKR = 1_000_000n;
const pool = makePool();

function setup(over: Partial<StakeFormProps> = {}) {
  const onSubmit = vi.fn();
  render(
    <StakeForm
      pool={pool}
      cfg={dayConfigFromPool(pool)}
      targetDay={D0}
      isTomorrow={false}
      decimals={6}
      label="SKR"
      balance={60n * SKR}
      solShortfall={null}
      bundledClaim={null}
      busy={false}
      onSubmit={onSubmit}
      {...over}
    />,
  );
  return { onSubmit };
}

const goalInput = () => screen.getByLabelText("Daily goal") as HTMLInputElement;
const amountInput = () => screen.getByLabelText("Stake") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: /^(Commit|Claim & commit)/ });

describe("StakeForm", () => {
  it("offers all 16 exercises, filterable by category", () => {
    setup();
    const grid = screen.getByRole("radiogroup", { name: "Exercise" });
    expect(within(grid).getAllByRole("radio")).toHaveLength(16);
    fireEvent.click(screen.getByRole("radio", { name: "Core" }));
    const core = within(screen.getByRole("radiogroup", { name: "Exercise" })).getAllByRole("radio");
    expect(core.length).toBeLessThan(16);
    expect(core.map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Plank/)]));
  });

  it("goal stepper uses the pool's per-exercise bounds and units", () => {
    setup();
    expect(goalInput().value).toBe("20");
    expect(screen.getByText(/Allowed 10 to 1,000 reps/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Plank/ }));
    expect(goalInput().value).toBe("60");
    expect(screen.getByText(/allowed 30 s to 60 min/)).toBeTruthy();
    fireEvent.change(goalInput(), { target: { value: "5" } });
    fireEvent.blur(goalInput());
    expect(goalInput().value).toBe("30");
    expect((screen.getByRole("button", { name: "Decrease goal" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Increase goal" }));
    expect(goalInput().value).toBe("35");
  });

  it("bounds the amount by the pool min and the wallet balance", () => {
    const { onSubmit } = setup();
    fireEvent.change(amountInput(), { target: { value: "0.5" } });
    expect(screen.getByRole("alert").textContent).toBe("The minimum stake is 1 SKR.");
    fireEvent.change(amountInput(), { target: { value: "75" } });
    expect(screen.getByRole("alert").textContent).toMatch(/more SKR than your wallet holds/);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(submit().closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("quick picks fill the amount; picks above the balance are disabled", () => {
    setup({ balance: 3n * SKR });
    let picks = within(screen.getByRole("radiogroup", { name: "Quick amounts" })).getAllByRole("radio") as HTMLButtonElement[];
    expect(picks.map((p) => p.disabled)).toEqual([true, true, true, true]);
    cleanup();
    setup({ balance: 30n * SKR });
    picks = within(screen.getByRole("radiogroup", { name: "Quick amounts" })).getAllByRole("radio") as HTMLButtonElement[];
    expect(picks.map((p) => p.textContent)).toEqual(["5 SKR", "10 SKR", "25 SKR"]);
    fireEvent.click(picks[2]);
    expect(amountInput().value).toBe("25");
    expect(submit().textContent).toMatch(/Commit 25 SKR/);
  });

  it("submits the chosen exercise, goal and amount; rules state the deal", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /Squats/ }));
    fireEvent.change(amountInput(), { target: { value: "12.5" } });
    fireEvent.click(submit());
    expect(onSubmit).toHaveBeenCalledWith({ exercise: "squat", goalTarget: 25, amount: 12_500_000n });
    const rules = screen.getByRole("region", { name: "The deal" });
    expect(rules.textContent).toMatch(/forfeited to the people who showed up/);
    expect(rules.textContent).toMatch(/5% fee on\s+forfeited stakes only/);
    expect(rules.textContent).toMatch(/25 squats/);
    expect(rules.querySelector("time")).toBeTruthy();
  });

  it("blocks on a SOL shortfall and mentions a bundled claim", () => {
    setup({ solShortfall: "You need about 0.006 SOL", bundledClaim: "≈ 147.5 SKR" });
    expect(screen.getByRole("note").textContent).toMatch(/0.006 SOL/);
    expect(document.body.textContent).toMatch(/≈ 147.5 SKR/);
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(submit().textContent).toMatch(/^Claim & commit/);
  });

  it("formats fee percentages", () => {
    expect(formatFeePercent(500)).toBe("5%");
    expect(formatFeePercent(125)).toBe("1.25%");
  });
});
