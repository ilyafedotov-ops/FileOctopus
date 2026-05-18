import { FileOctopusShell } from "@fileoctopus/frontend";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fileoctopus/ui/tokens.css";
import "@fileoctopus/ui/components.css";
import "./App.css";

function App() {
  return (
    <FileOctopusShell
      onRequestExit={() => {
        void getCurrentWindow().close();
      }}
    />
  );
}

export default App;
