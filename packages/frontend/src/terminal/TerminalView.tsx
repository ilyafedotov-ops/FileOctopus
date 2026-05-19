import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import { useTerminal } from "../app/providers/TerminalProvider";
import { buildTerminalTheme } from "./terminalTheme";

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "var(--fo-mono, ui-monospace, monospace)",
      fontSize: 13,
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

    const resize = () => {
      fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      if (cols > 0 && rows > 0) {
        void client.terminal.resize({ sessionId, cols, rows });
      }
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    requestAnimationFrame(resize);

    const onData = terminal.onData((data) => {
      const encoded = btoa(
        Array.from(new TextEncoder().encode(data), (byte) =>
          String.fromCharCode(byte),
        ).join(""),
      );
      void client.terminal.write({ sessionId, data: encoded });
    });

    const unregister = registerTerminalSessionHandlers(sessionId, {
      onOutput: (data) => {
        const binary = atob(data);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        terminal.write(bytes);
      },
      onExit: (exitCode) => {
        onExit(exitCode);
      },
    });

    return () => {
      observer.disconnect();
      onData.dispose();
      unregister();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [client, onExit, registerTerminalSessionHandlers, sessionId]);

  useEffect(() => {
    if (!active) {
      return;
    }
    requestAnimationFrame(() => {
      fitRef.current?.fit();
      terminalRef.current?.focus();
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
