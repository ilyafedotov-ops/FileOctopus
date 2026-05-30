import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WizardShell } from "../src/components/WizardShell";

afterEach(() => cleanup());

function renderWizard(
  overrides: Partial<React.ComponentProps<typeof WizardShell>> = {},
) {
  const props: React.ComponentProps<typeof WizardShell> = {
    open: true,
    onClose: vi.fn(),
    title: "Add Server",
    steps: ["Target", "Credentials", "Save"],
    currentStep: 0,
    onPrimary: vi.fn(),
    primaryLabel: "Next",
    children: <p>step body</p>,
    ...overrides,
  };
  render(<WizardShell {...props} />);
  return props;
}

describe("WizardShell (UPP-F1)", () => {
  it("renders the step indicator and marks the active step", () => {
    renderWizard({ currentStep: 1 });
    const active = screen
      .getByText("Credentials")
      .closest(".fo-wizard-step") as HTMLElement;
    expect(active.className).toContain("fo-wizard-step-active");
    expect(active.getAttribute("aria-current")).toBe("step");
  });

  it("hides Back on the first step and shows it afterwards", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <WizardShell
        open
        onClose={vi.fn()}
        title="W"
        steps={["A", "B"]}
        currentStep={0}
        onBack={onBack}
        onPrimary={vi.fn()}
        primaryLabel="Next"
      >
        <p>body</p>
      </WizardShell>,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    rerender(
      <WizardShell
        open
        onClose={vi.fn()}
        title="W"
        steps={["A", "B"]}
        currentStep={1}
        onBack={onBack}
        onPrimary={vi.fn()}
        primaryLabel="Save"
      >
        <p>body</p>
      </WizardShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("fires onPrimary and onClose from the footer", () => {
    const props = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("allows jumping only to reached steps via the indicator", () => {
    const onStepSelect = vi.fn();
    renderWizard({ currentStep: 1, onStepSelect });
    // Reached step (index 0) is clickable.
    fireEvent.click(screen.getByText("Target"));
    expect(onStepSelect).toHaveBeenCalledWith(0);
    // Future step (index 2) is disabled.
    onStepSelect.mockClear();
    fireEvent.click(screen.getByText("Save"));
    expect(onStepSelect).not.toHaveBeenCalled();
  });

  it("shows a validation/operation error when provided", () => {
    renderWizard({ error: "Label and host are required." });
    expect(screen.getByText("Label and host are required.")).toBeTruthy();
  });
});
