import { FileOctopusShell } from "@fileoctopus/frontend";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fileoctopus/ui/tokens.css";
import "@fileoctopus/ui/components.css";
import "./App.css";

function App() {
  const appWindow =
    typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis
      ? getCurrentWindow()
      : null;

  return (
    <FileOctopusShell
      onRequestExit={() => {
        void appWindow?.close();
      }}
      onRequestMinimize={() => {
        void appWindow?.minimize();
      }}
      onRequestToggleMaximize={() => {
        void appWindow?.toggleMaximize();
      }}
    />
  );
}

export default App;
