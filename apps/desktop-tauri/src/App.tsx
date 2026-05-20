import { FileOctopusShell } from "@fileoctopus/frontend";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fileoctopus/ui/tokens.css";
import "@fileoctopus/ui/components.css";
import "./App.css";

function isDesktopShell(): boolean {
  return typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis;
}

function App() {
  return (
    <FileOctopusShell
      onRequestExit={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().close();
          return;
        }
        globalThis.close();
      }}
      onRequestMinimize={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().minimize();
        }
      }}
      onRequestToggleMaximize={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().toggleMaximize();
        }
      }}
    />
  );
}

export default App;
