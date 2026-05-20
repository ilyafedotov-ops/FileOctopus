import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { SettingsDialog } from "../src/components/SettingsDialog";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

afterEach(cleanup);

const basePreferences = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "details",
  showHiddenFiles: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: false,
  activityPanelWidth: 320,
  confirmDelete: true,
  confirmPermanentDelete: true,
  useTrashByDefault: true,
  defaultConflictPolicy: "fail",
  accentColor: "blue",
  fontScale: "1",
  iconScale: "1",
  confirmOverwrite: true,
  sidebarVisible: true,
  statusBarVisible: true,
  toolbarVisible: true,
  toolbarEntries: "",
  paneMode: "dual",
  jobDrawerBehavior: "auto",
  showAdvancedCopyOptions: false,
  paneTerminalHeightLeft: 0.35,
  paneTerminalHeightRight: 0.35,
  paneTerminalDefaultOpen: false,
  terminalCdOnNavigate: false,
  confirmClosePaneWithTerminal: true,
  terminalShell: "",
  terminalArgs: "",
};

function renderDialog(overrides: Record<string, unknown> = {}) {
  const preferences = { ...basePreferences, ...overrides };
  const onChange = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <SettingsDialog
      open={true}
      preferences={preferences as UserPreferencesDto}
      onChange={onChange}
      onClose={onClose}
      autostart={{ supported: true, enabled: false }}
      onSetAutostart={() => Promise.resolve()}
    />,
  );
  return { ...result, onChange, onClose, preferences };
}

function clickOperationsTab() {
  const nav = screen.getByRole("navigation", { name: "Settings sections" });
  const opsTab = Array.from(nav.querySelectorAll("button")).find(
    (b) => b.textContent === "Operations",
  );
  if (!opsTab) throw new Error("Operations tab not found");
  fireEvent.click(opsTab);
}

describe("SettingsDialog — Operations tab", () => {
  it("renders Operations tab in navigation", () => {
    renderDialog();
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    const opsTab = Array.from(nav.querySelectorAll("button")).find(
      (b) => b.textContent === "Operations",
    );
    expect(opsTab).toBeTruthy();
  });

  it("shows confirm move to trash checkbox", () => {
    renderDialog();
    clickOperationsTab();
    expect(screen.getByText("Confirm move to trash")).toBeTruthy();
  });

  it("shows confirm permanent delete checkbox", () => {
    renderDialog();
    clickOperationsTab();
    expect(screen.getByText("Confirm permanent delete")).toBeTruthy();
  });

  it("shows confirm overwrite checkbox", () => {
    renderDialog();
    clickOperationsTab();
    expect(screen.getByText("Confirm before overwriting files")).toBeTruthy();
  });

  it("shows advanced copy options checkbox", () => {
    renderDialog();
    clickOperationsTab();
    expect(screen.getByText("Show advanced copy options")).toBeTruthy();
  });

  it("shows use trash by default checkbox", () => {
    renderDialog();
    clickOperationsTab();
    expect(screen.getByText("Use trash by default")).toBeTruthy();
  });

  it("toggling confirm delete fires onChange", () => {
    const { onChange } = renderDialog({ confirmDelete: true });
    clickOperationsTab();

    const region = screen.getByRole("region", { name: "Operations settings" });
    const checkboxes = within(region).getAllByRole("checkbox");
    const confirmDeleteBox = checkboxes.find(
      (cb) =>
        cb.closest("label")?.textContent?.indexOf("Confirm move to trash") !==
        -1,
    );
    expect(confirmDeleteBox).toBeTruthy();
    fireEvent.click(confirmDeleteBox!);
    expect(onChange).toHaveBeenCalledWith("confirmDelete", "false");
  });

  it("reflects confirmOverwrite=false as unchecked", () => {
    renderDialog({ confirmOverwrite: false });
    clickOperationsTab();

    const region = screen.getByRole("region", { name: "Operations settings" });
    const checkboxes = within(region).getAllByRole("checkbox");
    const overwriteBox = checkboxes.find(
      (cb) =>
        cb
          .closest("label")
          ?.textContent?.indexOf("Confirm before overwriting files") !== -1,
    );
    expect(overwriteBox).toBeTruthy();
    expect((overwriteBox as HTMLInputElement).checked).toBe(false);
  });

  it("toggling advanced copy options fires onChange", () => {
    const { onChange } = renderDialog({ showAdvancedCopyOptions: false });
    clickOperationsTab();

    fireEvent.click(screen.getByLabelText("Show advanced copy options"));
    expect(onChange).toHaveBeenCalledWith("showAdvancedCopyOptions", "true");
  });
});
