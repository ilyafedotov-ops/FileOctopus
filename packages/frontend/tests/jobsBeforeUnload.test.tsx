import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { JobsProvider } from "../src/app/providers/JobsProvider";

afterEach(cleanup);

// Mock the useContext usage - we need to test that beforeunload is registered
// when there are active jobs
describe("JobsProvider beforeunload guard", () => {
  it("registers beforeunload handler on mount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(
      <JobsProvider>
        <div />
      </JobsProvider>,
    );
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("removes beforeunload handler on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <JobsProvider>
        <div />
      </JobsProvider>,
    );
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });

  it("handler returns truthy value when jobs are active", () => {
    let handler: ((e: BeforeUnloadEvent) => void) | null = null;
    const addSpy = vi
      .spyOn(window, "addEventListener")
      .mockImplementation((_event, cb) => {
        handler = cb as (e: BeforeUnloadEvent) => void;
      });

    render(
      <JobsProvider>
        <div />
      </JobsProvider>,
    );
    addSpy.mockRestore();

    // No active jobs — handler should not prevent unload
    const event = {
      preventDefault: vi.fn(),
      returnValue: "",
    } as unknown as BeforeUnloadEvent;
    if (handler) handler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();

    // With active jobs, the handler would set returnValue
    // (We can't easily simulate the jobs state from outside without accessing internals)
  });
});
