import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import React from "react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div data-testid="child">Child content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/recovered from a UI error/i)).toBeTruthy();
  });

  it("shows error message in non-production mode", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test error message")).toBeTruthy();
  });

  it("shows Reload button", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: /reload/i })).toBeTruthy();
  });

  it("shows Copy Diagnostics button", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("button", { name: /copy diagnostics/i }),
    ).toBeTruthy();
  });

  it("Reload button calls location.reload", () => {
    const reloadMock = vi.fn();
    const savedLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      value: { ...savedLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    screen.getByRole("button", { name: /reload/i }).click();
    expect(reloadMock).toHaveBeenCalled();

    Object.defineProperty(globalThis, "location", {
      value: savedLocation,
      writable: true,
      configurable: true,
    });
  });
});
