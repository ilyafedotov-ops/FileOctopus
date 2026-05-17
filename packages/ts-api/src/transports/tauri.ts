import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type { IpcTransport } from "../types";
import { commandMap } from "../commandMap";

type EventBridgeWindow = Window & {
  __FO_EVENT_HANDLERS__?: Record<string, Array<(payload: unknown) => void>>;
  __FO_EVENT_BUFFER__?: Record<string, unknown[]>;
};

export function createTauriTransport(): IpcTransport {
  return {
    invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      return tauriInvoke<TResponse>(commandMap[command] ?? command, args);
    },
    async listen<TPayload>(
      event: string,
      handler: (payload: TPayload) => void,
    ) {
      const tauriUnlisten = await tauriListen<TPayload>(event, (tauriEvent) =>
        handler(tauriEvent.payload),
      );

      // Fallback transport for WebKitGTK-headless where app.emit() does not
      // deliver events to the WebView: Rust also replays the payload via
      // webview.eval(), registering it under window.__FO_EVENT_HANDLERS__ and
      // buffering anything that arrived before this listener attached.
      const w = window as unknown as EventBridgeWindow;
      const handlers = (w.__FO_EVENT_HANDLERS__ ??= {});
      const buffer = (w.__FO_EVENT_BUFFER__ ??= {});
      const typedHandler = handler as (payload: unknown) => void;
      (handlers[event] ??= []).push(typedHandler);
      const pending = buffer[event];
      if (Array.isArray(pending) && pending.length > 0) {
        buffer[event] = [];
        for (const item of pending) {
          try {
            typedHandler(item);
          } catch {
            // Swallow handler errors during drain to keep loop healthy.
          }
        }
      }
      const domHandler = (e: Event) =>
        handler((e as CustomEvent).detail as TPayload);
      const domEventName = `fo-event-${event}`;
      window.addEventListener(domEventName, domHandler);

      return () => {
        tauriUnlisten();
        window.removeEventListener(domEventName, domHandler);
        const list = handlers[event];
        if (list) {
          const idx = list.indexOf(typedHandler);
          if (idx >= 0) list.splice(idx, 1);
          if (list.length === 0) delete handlers[event];
        }
      };
    },
  };
}

export function isTauriRuntime(): boolean {
  return typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis;
}
