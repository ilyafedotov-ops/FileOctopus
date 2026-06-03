import { JSDOM } from "jsdom";
import { vi } from "vitest";

function installWebStorage(): void {
  try {
    if (typeof globalThis.localStorage?.getItem === "function") {
      globalThis.localStorage.getItem("__fileoctopus_probe__");
      return;
    }
  } catch {
    // Node experimental localStorage without --localstorage-file
  }

  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");

  const { window } = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: window.localStorage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: window.sessionStorage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "Storage", {
    value: window.Storage,
    configurable: true,
    writable: true,
  });
}

installWebStorage();

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => ({
      fillRect() {},
      clearRect() {},
      getImageData() {
        return { data: new Uint8ClampedArray() };
      },
      putImageData() {},
      createImageData() {
        return [];
      },
      setTransform() {},
      drawImage() {},
      save() {},
      fillText() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {},
      translate() {},
      scale() {},
      rotate() {},
      arc() {},
      fill() {},
      measureText() {
        return { width: 0 };
      },
      transform() {},
      rect() {},
      clip() {},
    }),
    configurable: true,
  });
}

vi.mock("@xterm/xterm", () => {
  class Terminal {
    open() {}
    dispose() {}
    focus() {}
    blur() {}
    loadAddon() {}
    write() {}
    writeln() {}
    clear() {}
    reset() {}
    resize() {}
    onData() {
      return { dispose() {} };
    }
    onResize() {
      return { dispose() {} };
    }
    onTitleChange() {
      return { dispose() {} };
    }
    onSelectionChange() {
      return { dispose() {} };
    }
    get textarea() {
      return null;
    }
  }

  return { Terminal };
});

vi.mock("@xterm/addon-fit", () => {
  class FitAddon {
    fit() {}
    dispose() {}
  }

  return { FitAddon };
});

vi.mock("@xterm/addon-web-links", () => {
  class WebLinksAddon {
    dispose() {}
  }

  return { WebLinksAddon };
});
