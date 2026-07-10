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
const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent,
  );
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
        void client.terminal
          .write({
            sessionId: sid,
            data: encodeTerminalInput(sequence),
          })
          .catch(() => undefined);
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
            if (text) {
              void navigator.clipboard.writeText(text).catch(() => undefined);
            }
            term.clearSelection();
          } else {
            sendControlSequence("\x03");
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          return true;
        }
        if (key === "v") {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && terminalRef.current) {
                terminalRef.current.paste(text);
              }
            })
            .catch(() => undefined);
          event.preventDefault();
          event.stopImmediatePropagation();
          return true;
        }
        return false;
      };

      const handleInterruptKeys = (event: KeyboardEvent) => {
        const ownsEvent = eventTargetsThisTerminal(event);
        if (!ownsEvent) {
          return;
        }
        if (handleMacClipboardShortcuts(event)) {
          return;
        }
        const control = terminalControlFromKeydown(event);
        if (!control) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        sendControlSequence(control);
      };

      const stopKeyBubble = (event: KeyboardEvent) => {
        event.stopPropagation();
      };

      window.addEventListener("keydown", handleInterruptKeys, true);
      document.addEventListener("keydown", handleInterruptKeys, true);
      container.addEventListener("keydown", stopKeyBubble);
      container.addEventListener("keyup", stopKeyBubble);
      container.addEventListener("mousedown", focusTerminal);
      container.addEventListener("pointerdown", focusTerminal);
      container.addEventListener("click", focusTerminal);

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
        void client.terminal
          .write({ sessionId: sid, data: encodeTerminalInput(data) })
          .catch(() => undefined);
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
