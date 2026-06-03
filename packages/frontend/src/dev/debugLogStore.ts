export type DebugLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "log"
  | "warn"
  | "error";

export type DebugLogSource = "frontend" | "backend";

export interface DebugLogEntry {
  id: number;
  level: DebugLogLevel;
  source: DebugLogSource;
  timestamp: number;
  message: string;
  target?: string;
}

interface BackendLogRecord {
  level: string;
  target: string;
  message: string;
  timestampMs: number;
}

const BACKEND_LEVELS: Record<string, DebugLogLevel> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

const MAX_ENTRIES = 1000;

let nextId = 1;
let buffer: DebugLogEntry[] = [];
let listeners: Array<(entries: DebugLogEntry[]) => void> = [];

function notify(): void {
  const snapshot = buffer.slice();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function serializeArg(arg: unknown): string {
  if (typeof arg === "string") {
    return arg;
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function appendLogEntry(level: DebugLogLevel, args: unknown[]): void {
  const message = args.map(serializeArg).join(" ");
  pushEntry({
    id: nextId++,
    level,
    source: "frontend",
    timestamp: Date.now(),
    message,
  });
}

function pushEntry(entry: DebugLogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  notify();
}

export function pushBackendLog(record: BackendLogRecord): void {
  pushEntry({
    id: nextId++,
    level: BACKEND_LEVELS[record.level.toLowerCase()] ?? "log",
    source: "backend",
    timestamp: record.timestampMs || Date.now(),
    message: record.message,
    target: record.target,
  });
}

export function subscribeDebugLog(
  listener: (entries: DebugLogEntry[]) => void,
): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function getDebugLog(): DebugLogEntry[] {
  return buffer.slice();
}

export function clearDebugLog(): void {
  buffer = [];
  notify();
}

let consoleInstalled = false;

export function installConsoleCapture(): void {
  if (consoleInstalled || typeof console === "undefined") {
    return;
  }
  consoleInstalled = true;
  const target = console as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
  const origLog = target.log.bind(console);
  const origWarn = target.warn.bind(console);
  const origError = target.error.bind(console);
  target.log = (...args: unknown[]) => {
    origLog(...args);
    appendLogEntry("log", args);
  };
  target.warn = (...args: unknown[]) => {
    origWarn(...args);
    appendLogEntry("warn", args);
  };
  target.error = (...args: unknown[]) => {
    origError(...args);
    appendLogEntry("error", args);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
      appendLogEntry("error", [
        `[window:error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      ]);
    });
    window.addEventListener("unhandledrejection", (event) => {
      appendLogEntry("error", [
        `[unhandledrejection] ${serializeArg(event.reason)}`,
      ]);
    });
  }
}
