import { SearchAddon } from "@xterm/addon-search";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  FileOctopusClient,
  TerminalProfileDto,
} from "@fileoctopus/ts-api";
import { useTerminal } from "../app/providers/TerminalProvider";
import { terminalOptionsForProfile } from "./terminalProfileRuntime";
import { encodeTerminalInput, terminalControlFromKeydown } from "./shellEscape";
import type { TerminalSearchDirection } from "./TerminalTabBar";

const SAFE_LINK_SCHEMES = new Set(["http:", "https:"]);
const TERMINAL_DEBUG_PREFIX = "[fileoctopus:terminal]";
const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent,
  );
const TERMINAL_DEBUG_ENABLED =
  typeof globalThis !== "undefined" &&
  (globalThis as { __FILEOCTOPUS_TERMINAL_DEBUG__?: boolean })
    .__FILEOCTOPUS_TERMINAL_DEBUG__ !== false;

interface TerminalViewProps {
  client: FileOctopusClient;
  sessionId: string;
  active: boolean;
  profile?: TerminalProfileDto | null;
  onExit: (exitCode?: number | null) => void;
}

export interface TerminalViewHandle {
  search: (query: string, direction: TerminalSearchDirection) => boolean;
}

function terminalDebug(event: string, payload: Record<string, unknown>) {
  if (!TERMINAL_DEBUG_ENABLED) {
    return;
  }
  // Render the payload as a JSON-ish string so it's readable in DevTools without
  // having to expand the object (which is awkward when triaging quickly).
  let summary = "";
  try {
    summary = JSON.stringify(payload);
  } catch {
    summary = String(payload);
  }
  console.warn(`${TERMINAL_DEBUG_PREFIX} ${event} ${summary}`);
}

function dataToHex(data: string): string {
  return Array.from(data, (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join(" ");
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView({ client, sessionId, active, profile, onExit }, ref) {
    const { registerTerminalSessionHandlers } = useTerminal();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const searchRef = useRef<SearchAddon | null>(null);
    const decoderRef = useRef(new TextDecoder());
    const onExitRef = useRef(onExit);
    const sessionIdRef = useRef(sessionId);
    onExitRef.current = onExit;
    sessionIdRef.current = sessionId;

    useImperativeHandle(
      ref,
      () => ({
        search: (query, direction) => {
          const search = searchRef.current;
          const trimmed = query.trim();
          if (!search || !trimmed) {
            search?.clearDecorations();
            return false;
          }
          const options = {
            decorations: {
              matchBackground: "#665500",
              matchOverviewRuler: "#d8a100",
              activeMatchBackground: "#1f5fbf",
              activeMatchColorOverviewRuler: "#4f8cff",
            },
          };
          return direction === "previous"
            ? search.findPrevious(trimmed, options)
            : search.findNext(trimmed, options);
        },
      }),
      [],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const terminal = new Terminal({
        ...terminalOptionsForProfile(profile),
      });
      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon({ highlightLimit: 1000 });
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(searchAddon);
      terminal.loadAddon(
        new WebLinksAddon((_event, uri) => {
          try {
            const url = new URL(uri);
            if (!SAFE_LINK_SCHEMES.has(url.protocol)) {
              return;
            }
            window.open(url.href, "_blank", "noopener,noreferrer");
          } catch {
            /* ignore invalid URLs */
          }
        }),
      );
      terminal.open(container);
      terminal.attachCustomKeyEventHandler((event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.key === "Backspace" ||
          event.key === "Delete"
        ) {
          terminalDebug("xterm-key", {
            type: event.type,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
          });
        }
        return true;
      });
      terminalRef.current = terminal;
      fitRef.current = fitAddon;
      searchRef.current = searchAddon;

      const focusTerminal = () => {
        terminal.focus();
        container
          .querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
          ?.focus();
      };

      const sendControlSequence = (sequence: string) => {
        const sid = sessionIdRef.current;
        terminalDebug("control-write", {
          sessionId: sid,
          hex: dataToHex(sequence),
        });
        void client.terminal
          .write({
            sessionId: sid,
            data: encodeTerminalInput(sequence),
          })
          .catch((error) => {
            terminalDebug("control-write-error", {
              sessionId: sid,
              message: error instanceof Error ? error.message : String(error),
            });
          });
      };

      const eventTargetsThisTerminal = (event: KeyboardEvent): boolean => {
        const host = containerRef.current;
        if (!host) {
          return false;
        }
        const path =
          typeof event.composedPath === "function" ? event.composedPath() : [];
        if (path.includes(host)) {
          return true;
        }
        if (event.target instanceof Node && host.contains(event.target)) {
          return true;
        }
        const activeElement = document.activeElement;
        if (activeElement instanceof Node && host.contains(activeElement)) {
          return true;
        }
        return false;
      };

      const handleMacClipboardShortcuts = (event: KeyboardEvent): boolean => {
        if (!IS_MAC) {
          return false;
        }
        // Only plain Cmd+letter (no Ctrl/Opt/Shift) is treated as a Mac clipboard shortcut.
        if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return false;
        }
        const key = event.key.toLowerCase();
        const term = terminalRef.current;
        if (!term) {
          return false;
        }
        if (key === "c") {
          // Copy if there is a selection, otherwise send SIGINT — matching iTerm2 /
          // Terminal.app convention so Mac users can still interrupt running commands
          // with the muscle-memory Cmd+C.
          if (term.hasSelection()) {
            const text = term.getSelection();
            terminalDebug("cmd-c-copy", {
              sessionId: sessionIdRef.current,
              length: text.length,
            });
            if (text) {
              void navigator.clipboard.writeText(text).catch((error) => {
                terminalDebug("clipboard-write-error", {
                  message:
                    error instanceof Error ? error.message : String(error),
                });
              });
            }
            term.clearSelection();
          } else {
            terminalDebug("cmd-c-sigint", { sessionId: sessionIdRef.current });
            sendControlSequence("\x03");
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          return true;
        }
        if (key === "v") {
          terminalDebug("cmd-v-paste", { sessionId: sessionIdRef.current });
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && terminalRef.current) {
                terminalRef.current.paste(text);
              }
            })
            .catch((error) => {
              terminalDebug("clipboard-read-error", {
                message: error instanceof Error ? error.message : String(error),
              });
            });
          event.preventDefault();
          event.stopImmediatePropagation();
          return true;
        }
        return false;
      };

      const handleInterruptKeys = (event: KeyboardEvent) => {
        const ownsEvent = eventTargetsThisTerminal(event);
        // Log every keydown that either belongs to this terminal OR uses a modifier —
        // this lets us prove Ctrl+C is actually reaching the window listener.
        if (
          ownsEvent ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.key === "Backspace" ||
          event.key === "Delete"
        ) {
          terminalDebug("keydown", {
            sessionId: sessionIdRef.current,
            ownsEvent,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            activeTag:
              document.activeElement instanceof HTMLElement
                ? document.activeElement.tagName.toLowerCase()
                : null,
          });
        }
        if (!ownsEvent) {
          return;
        }
        if (handleMacClipboardShortcuts(event)) {
          return;
        }
        const control = terminalControlFromKeydown(event);
        if (!control) {
          terminalDebug("keydown-no-control", {
            sessionId: sessionIdRef.current,
            key: event.key,
            code: event.code,
          });
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        sendControlSequence(control);
      };

      const stopKeyBubble = (event: KeyboardEvent) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.key === "Backspace" ||
          event.key === "Delete"
        ) {
          terminalDebug("container-key", {
            type: event.type,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            defaultPrevented: event.defaultPrevented,
          });
        }
        event.stopPropagation();
      };

      window.addEventListener("keydown", handleInterruptKeys, true);
      document.addEventListener("keydown", handleInterruptKeys, true);
      container.addEventListener("keydown", stopKeyBubble);
      container.addEventListener("keyup", stopKeyBubble);
      container.addEventListener("mousedown", focusTerminal);
      container.addEventListener("pointerdown", focusTerminal);
      container.addEventListener("click", focusTerminal);
      terminalDebug("mount", {
        sessionId: sessionIdRef.current,
        hasContainer: true,
      });

      const resize = () => {
        fitAddon.fit();
        const cols = terminal.cols;
        const rows = terminal.rows;
        if (cols > 0 && rows > 0) {
          void client.terminal.resize({
            sessionId: sessionIdRef.current,
            cols,
            rows,
          });
        }
      };

      const observer = new ResizeObserver(() => resize());
      observer.observe(container);
      requestAnimationFrame(() => {
        resize();
        if (active) {
          focusTerminal();
        }
      });

      const onData = terminal.onData((data) => {
        const sid = sessionIdRef.current;
        terminalDebug("xterm-data", {
          sessionId: sid,
          length: data.length,
          hex: dataToHex(data),
        });
        void client.terminal
          .write({ sessionId: sid, data: encodeTerminalInput(data) })
          .catch((error) => {
            terminalDebug("xterm-write-error", {
              sessionId: sid,
              message: error instanceof Error ? error.message : String(error),
            });
          });
      });

      const unregister = registerTerminalSessionHandlers(sessionId, {
        onOutput: (data) => {
          const binary = atob(data);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          terminal.write(decoderRef.current.decode(bytes, { stream: true }));
        },
        onExit: (exitCode) => {
          onExitRef.current(exitCode);
        },
      });

      return () => {
        window.removeEventListener("keydown", handleInterruptKeys, true);
        document.removeEventListener("keydown", handleInterruptKeys, true);
        container.removeEventListener("keydown", stopKeyBubble);
        container.removeEventListener("keyup", stopKeyBubble);
        container.removeEventListener("mousedown", focusTerminal);
        container.removeEventListener("pointerdown", focusTerminal);
        container.removeEventListener("click", focusTerminal);
        observer.disconnect();
        onData.dispose();
        unregister();
        terminal.dispose();
        terminalRef.current = null;
        fitRef.current = null;
        searchRef.current = null;
        decoderRef.current = new TextDecoder();
      };
    }, [client, profile, registerTerminalSessionHandlers, sessionId]);

    useEffect(() => {
      if (!active) {
        return;
      }
      requestAnimationFrame(() => {
        fitRef.current?.fit();
        const container = containerRef.current;
        const terminal = terminalRef.current;
        if (!container || !terminal) {
          return;
        }
        terminal.focus();
        container
          .querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
          ?.focus();
      });
    }, [active]);

    return (
      <div
        ref={containerRef}
        className="fo-terminal-view-host"
        data-active={active ? "true" : "false"}
      />
    );
  },
);
