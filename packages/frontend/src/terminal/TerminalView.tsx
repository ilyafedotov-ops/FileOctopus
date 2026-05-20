import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import { useTerminal } from "../app/providers/TerminalProvider";
import { isTerminalInputContext } from "../shortcuts";
import { buildTerminalTheme } from "./terminalTheme";
import { encodeTerminalInput, terminalControlFromKeydown } from "./shellEscape";

const SAFE_LINK_SCHEMES = new Set(["http:", "https:"]);

interface TerminalViewProps {
  client: FileOctopusClient;
  sessionId: string;
  active: boolean;
  onExit: (exitCode?: number | null) => void;
}

export function TerminalView({
  client,
  sessionId,
  active,
  onExit,
}: TerminalViewProps) {
  const { registerTerminalSessionHandlers } = useTerminal();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const onExitRef = useRef(onExit);
  const sessionIdRef = useRef(sessionId);
  onExitRef.current = onExit;
  sessionIdRef.current = sessionId;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily:
        'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Mono", Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: buildTerminalTheme(),
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
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

    const focusTerminal = () => {
      terminal.focus();
      container
        .querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
        ?.focus();
    };

    const sendControlSequence = (sequence: string) => {
      void client.terminal
        .write({
          sessionId: sessionIdRef.current,
          data: encodeTerminalInput(sequence),
        })
        .catch(() => {
          /* session may have exited */
        });
    };

    const handleInterruptKeys = (event: KeyboardEvent) => {
      if (!isTerminalInputContext()) {
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
      void client.terminal.write({
        sessionId: sessionIdRef.current,
        data: encodeTerminalInput(data),
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
      decoderRef.current = new TextDecoder();
    };
  }, [client, registerTerminalSessionHandlers, sessionId]);

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
}
