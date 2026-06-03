import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearDebugLog,
  getDebugLog,
  installConsoleCapture,
  pushBackendLog,
  subscribeDebugLog,
  type DebugLogEntry,
  type DebugLogLevel,
  type DebugLogSource,
} from "./debugLogStore";
import { useModals } from "../app/providers/ModalsProvider";
import { useShell } from "../app/providers/ShellProvider";

installConsoleCapture();

const LEVEL_COLOR: Record<DebugLogLevel, string> = {
  trace: "#7d8694",
  debug: "#7aa2c4",
  info: "#5fb37a",
  log: "#9ab",
  warn: "#e4b343",
  error: "#e35757",
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
}

export function DebugConsolePanel() {
  const { debugConsoleOpen, setDebugConsoleOpen } = useModals();
  const { client } = useShell();
  const [entries, setEntries] = useState<DebugLogEntry[]>(() => getDebugLog());
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<DebugLogLevel | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<DebugLogSource | "all">(
    "all",
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeDebugLog(setEntries), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggle =
        (event.metaKey || event.ctrlKey) &&
        event.altKey &&
        (event.key === "l" || event.key === "L" || event.code === "KeyL");
      if (isToggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDebugConsoleOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [setDebugConsoleOpen]);

  // Stream backend (Rust) log records while the console is open.
  useEffect(() => {
    if (!debugConsoleOpen) {
      return;
    }
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    setStreamError(null);

    client.diagnostics
      .onLogRecord((record) => pushBackendLog(record))
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
        return client.diagnostics.startLogStream();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStreamError(
            error instanceof Error
              ? error.message
              : "Failed to start backend log stream",
          );
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
      void client.diagnostics.stopLogStream().catch(() => {
        /* noop */
      });
    };
  }, [debugConsoleOpen, client]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return entries.filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) {
        return false;
      }
      if (sourceFilter !== "all" && entry.source !== sourceFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        entry.message.toLowerCase().includes(q) ||
        (entry.target?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, filter, levelFilter, sourceFilter]);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [filtered, autoScroll]);

  if (!debugConsoleOpen) {
    return null;
  }

  const copyAll = async () => {
    const text = filtered
      .map(
        (entry) =>
          `[${formatTime(entry.timestamp)}] [${entry.source}] [${entry.level}]${entry.target ? ` ${entry.target}` : ""} ${entry.message}`,
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* noop */
    }
  };

  const controlStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    color: "inherit",
    padding: "2px 6px",
    font: "inherit",
  } as const;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 760,
        maxWidth: "calc(100vw - 32px)",
        height: 380,
        maxHeight: "calc(100vh - 32px)",
        background: "rgba(20, 22, 28, 0.96)",
        color: "#dadada",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        font: '12px ui-monospace, "SF Mono", Menlo, monospace',
      }}
      role="dialog"
      aria-label="Debug console"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <strong style={{ marginRight: 8 }}>Debug console</strong>
        <input
          type="search"
          placeholder="Filter…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          style={{ ...controlStyle, flex: 1 }}
        />
        <select
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(event.target.value as DebugLogSource | "all")
          }
          aria-label="Source filter"
          style={controlStyle}
        >
          <option value="all">all sources</option>
          <option value="backend">backend</option>
          <option value="frontend">frontend</option>
        </select>
        <select
          value={levelFilter}
          onChange={(event) =>
            setLevelFilter(event.target.value as DebugLogLevel | "all")
          }
          aria-label="Level filter"
          style={controlStyle}
        >
          <option value="all">all levels</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="log">log</option>
          <option value="debug">debug</option>
          <option value="trace">trace</option>
        </select>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
          />
          auto-scroll
        </label>
        <button
          type="button"
          onClick={() => void copyAll()}
          style={{ ...controlStyle, cursor: "pointer" }}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => clearDebugLog()}
          style={{ ...controlStyle, cursor: "pointer" }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => setDebugConsoleOpen(false)}
          aria-label="Close debug console"
          style={{ ...controlStyle, cursor: "pointer" }}
        >
          ×
        </button>
      </div>
      {streamError ? (
        <div
          style={{
            padding: "4px 8px",
            color: "#e35757",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {streamError}
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 6,
          background: "#11141a",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ color: "#7d8694", padding: 8 }}>
            No log entries match the current filter.
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                padding: "2px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <span style={{ color: "#7d8694", marginRight: 8 }}>
                {formatTime(entry.timestamp)}
              </span>
              <span
                style={{
                  color: entry.source === "backend" ? "#8a7bd8" : "#5f7d94",
                  marginRight: 8,
                  textTransform: "uppercase",
                  fontSize: 10,
                }}
              >
                {entry.source === "backend" ? "rust" : "ui"}
              </span>
              <span
                style={{
                  color: LEVEL_COLOR[entry.level],
                  marginRight: 8,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {entry.level}
              </span>
              {entry.target ? (
                <span style={{ color: "#7d8694", marginRight: 8 }}>
                  {entry.target}
                </span>
              ) : null}
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
      <div
        style={{
          padding: "4px 8px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          color: "#7d8694",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {filtered.length} / {entries.length} entries · streaming backend +
        frontend logs · toggle with{" "}
        <kbd style={{ color: "#dadada" }}>⌘/Ctrl + Opt + L</kbd>
      </div>
    </div>
  );
}
