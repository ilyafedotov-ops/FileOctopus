import { JSDOM } from "jsdom";

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
}

installWebStorage();
