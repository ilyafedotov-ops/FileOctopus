# FileOctopus — Usage

Keyboard shortcuts below match `packages/frontend/src/shortcuts.ts` plus `hooks/useKeyboardShortcuts.ts` in `FileOctopusApp`. The command palette (Ctrl/Cmd+P) lists commands from `commands/registry.ts` via `buildPaletteEntries()`. Open **Help → Keyboard Shortcuts** in the app for the platform-formatted list.

Shortcuts are ignored while typing in inputs, text areas, or contenteditable fields.

## Keyboard shortcuts

| Shortcut                                   | Action                                                  |
| ------------------------------------------ | ------------------------------------------------------- |
| `Tab`                                      | Switch active pane                                      |
| `Enter`                                    | Open selected folder or file                            |
| `Backspace` / `Alt+Up`                     | Parent folder                                           |
| `Alt+Left` / `Alt+Right`                   | Back / forward                                          |
| `Ctrl/Cmd+L`                               | Focus path bar                                          |
| `Ctrl/Cmd+F`                               | Focus current-folder filter                             |
| `Ctrl/Cmd+Shift+F`                         | Focus recursive search                                  |
| `Ctrl/Cmd+,`                               | Open Settings                                           |
| `Ctrl/Cmd+/`                               | Keyboard shortcuts dialog                               |
| `Ctrl/Cmd+P`                               | Command palette                                         |
| `Ctrl/Cmd+.` or `Ctrl/Cmd+H`               | Toggle hidden files                                     |
| `Ctrl/Cmd+R` or `F5`                       | Refresh active pane                                     |
| `Ctrl/Cmd+A`                               | Select all visible items                                |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+X` / `Ctrl/Cmd+V` | Copy / cut / paste (internal clipboard)                 |
| `F2`                                       | Rename                                                  |
| `Ctrl/Cmd+N`                               | New folder                                              |
| `Ctrl/Cmd+I`                               | Properties                                              |
| `Delete`                                   | Move to trash (with confirmation when enabled)          |
| `Shift+Delete`                             | Permanent delete (with confirmation)                    |
| `Space`                                    | Toggle text preview for selected file (text types only) |
| `Esc`                                      | Close palette, preview, dialog, or context menu         |

Arrow keys, Page Up/Down, Home, and End move selection in the file table.

## Core workflows

- Navigate via sidebar, breadcrumbs, path entry, or history buttons.
- Open folders in-app; open files with the OS default application.
- Use menu bar, toolbar, context menu, command palette, or shortcuts for copy, move, rename, new folder/file, trash, and properties.
- **Tools → Operation History** opens the full operation history dialog.
- Long operations show progress in the activity panel; cancel from the job card when running.
- **Help → Diagnostics** exports a redacted bundle for bug reports.

## Diagnostics

The Diagnostics dialog shows version, build profile, target OS, commit SHA when available, schema version, recovered job count, and data/log paths. Use **Export** to write a zip for support.

## Further reading

- [Architecture index](architecture/README.md)
- [API reference](architecture/api-reference.md) — IPC contract
- [Testing](testing/README.md)
