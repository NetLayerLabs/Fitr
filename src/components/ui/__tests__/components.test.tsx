// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "../Button";
import Card from "../Card";
import { Chip, ChipRow } from "../Chip";
import LimeMoment from "../LimeMoment";
import PageHeader from "../PageHeader";
import Ring, { clampFraction } from "../Ring";
import Sheet from "../Sheet";
import StatTile from "../StatTile";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders a type=button by default and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Start
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Start" });
    expect(btn.getAttribute("type")).toBe("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the decorative ▶ end cap without changing the name", () => {
    render(
      <Button variant="primary" size="lg" trailingPlay>
        Start workout
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Start workout" })).toBeTruthy();
    expect(screen.getByTestId("button-play-cap").getAttribute("aria-hidden")).toBe("true");
  });

  it("renders a link with href", () => {
    render(
      <Button variant="secondary" href="/workouts">
        Browse
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Browse" });
    expect(link.getAttribute("href")).toBe("/workouts");
  });

  it("renders a disabled link as aria-disabled without href", () => {
    render(
      <Button variant="primary" href="/commit" disabled>
        Commit
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Commit" });
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.hasAttribute("href")).toBe(false);
  });

  it("passes native props through and respects disabled", () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" type="submit" disabled aria-describedby="x" onClick={onClick}>
        Delete
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(btn.type).toBe("submit");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-describedby")).toBe("x");
    expect(btn.hasAttribute("variant")).toBe(false);
  });
});

function Filters({ onPick }: { onPick?: (v: string) => void }) {
  const [value, setValue] = useState("all");
  const pick = (v: string) => {
    setValue(v);
    onPick?.(v);
  };
  return (
    <ChipRow label="Category">
      {["all", "upper", "core"].map((v) => (
        <Chip key={v} selected={value === v} onClick={() => pick(v)} count={v === "core" ? 4 : undefined}>
          {v}
        </Chip>
      ))}
    </ChipRow>
  );
}

describe("Chip / ChipRow", () => {
  it("is a labelled radio group with one checked chip and one tab stop", () => {
    render(<Filters />);
    expect(screen.getByRole("radiogroup", { name: "Category" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("includes the count in the accessible name", () => {
    render(<Filters />);
    expect(screen.getByRole("radio", { name: /^core\W+4$/ })).toBeTruthy();
  });

  it("selects on click and moves selection with arrow keys", () => {
    const onPick = vi.fn();
    render(<Filters onPick={onPick} />);
    fireEvent.click(screen.getByRole("radio", { name: "upper" }));
    expect(screen.getByRole("radio", { name: "upper" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "upper" }).tabIndex).toBe(0);

    screen.getByRole("radio", { name: "upper" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(onPick).toHaveBeenLastCalledWith("core");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /^core\W+4$/ }));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(onPick).toHaveBeenLastCalledWith("all");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(onPick).toHaveBeenLastCalledWith("core");
  });
});

describe("Card", () => {
  it("renders the requested element with aria props", () => {
    render(
      <Card as="section" tone="lime" padding="lg" aria-label="Today's goal">
        hi
      </Card>,
    );
    const region = screen.getByRole("region", { name: "Today's goal" });
    expect(region.tagName).toBe("SECTION");
    expect(region.getAttribute("data-tone")).toBe("lime");
  });

  it("defaults to a div", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });
});

describe("StatTile", () => {
  it("groups label, value and unit", () => {
    render(<StatTile label="Streak" value={12} unit="days" hint="Best 20" />);
    const group = screen.getByRole("group", { name: "Streak" });
    expect(group.textContent).toContain("12");
    expect(group.textContent).toContain("days");
    expect(group.textContent).toContain("Best 20");
  });
});

describe("Ring", () => {
  it("is an accessible progressbar", () => {
    render(
      <Ring fraction={0.42} label="Reps done" valueText="8 of 20 reps">
        8
      </Ring>,
    );
    const bar = screen.getByRole("progressbar", { name: "Reps done" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toBe("8 of 20 reps");
  });

  it("clamps out-of-range and NaN fractions", () => {
    expect(clampFraction(-1)).toBe(0);
    expect(clampFraction(2)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0);
    render(<Ring fraction={5} label="Done" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });
});

describe("Sheet", () => {
  function Harness({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Sheet
          open={open}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          title="Pick a goal"
        >
          <button type="button">First</button>
          <button type="button">Last</button>
        </Sheet>
      </>
    );
  }

  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens labelled, focuses the first control, traps Tab, closes on Esc and restores focus", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Pick a goal" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));

    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last" }));

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes from the close button and the backdrop", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when clicking inside the panel", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("LimeMoment", () => {
  it("is a region named by its title with eyebrow, numeral and actions", () => {
    render(
      <LimeMoment
        eyebrow="Workout complete"
        title="Day 4 locked in"
        big={<span>20</span>}
        actions={<Button variant="primary">Done</Button>}
      >
        Verified by Fitr.
      </LimeMoment>,
    );
    const region = screen.getByRole("region", { name: "Day 4 locked in" });
    expect(region.textContent).toContain("Workout complete");
    expect(region.textContent).toContain("20");
    expect(region.textContent).toContain("Verified by Fitr.");
    expect(screen.getByRole("heading", { level: 1, name: "Day 4 locked in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });
});

describe("PageHeader", () => {
  it("renders an h1 with eyebrow, back link and action", () => {
    render(<PageHeader title="Progress" eyebrow="This week" back="/" action={<button type="button">Share</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Progress" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
  });

  it("omits the bar without back or action", () => {
    render(<PageHeader title="Today" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
