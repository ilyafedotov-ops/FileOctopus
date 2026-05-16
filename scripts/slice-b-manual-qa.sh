#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
Slice B manual QA — Settings dialog completion

Steps:
  1. Launch FileOctopus (pnpm dev).
  2. Open Settings (Ctrl+,).
  3. Appearance tab:
       - Click each accent swatch. The selected swatch shows a ring; toolbar
         buttons and badges recolor.
       - Switch Font size between Small / Medium / Large. UI text resizes.
       - Switch Icon size between Small / Medium / Large. Sidebar/toolbar
         icons resize.
  4. Files & Folders tab:
       - Toggle "Confirm before overwrite" off. Start a copy with conflict
         policy "Overwrite" to a destination with no name collisions; verify
         the confirm step is skipped. Toggle on; verify the confirm step
         appears.
  5. Layout tab:
       - Toggle "Show sidebar" off. Sidebar disappears, grid expands.
       - Toggle on. Sidebar restored at the previous width.
  6. General tab:
       - Toggle "Start automatically at login" on.
         Linux: verify ~/.config/autostart/FileOctopus.desktop exists.
         macOS: verify Login Items entry.
         Windows: verify HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.
       - Toggle off; verify the entry is removed.
       - On an unsupported platform, the switch should be disabled with the
         hint "Autostart is not supported on this platform."
  7. Restart the app; all toggles and selections persist (except the
     OS-level autostart, which lives in OS storage).
EOF
