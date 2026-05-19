import { vi } from "vitest";

export function mockTerminalClient() {
  return {
    spawn: vi.fn(async () => ({ sessionId: "terminal-test-session" })),
    write: vi.fn(async () => ({ success: true })),
    resize: vi.fn(async () => ({ success: true })),
    kill: vi.fn(async () => ({ success: true })),
    onOutput: vi.fn(async () => () => undefined),
    onExit: vi.fn(async () => () => undefined),
  };
}
