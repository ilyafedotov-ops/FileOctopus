# Sprint 4 Baseline File Manager QA

## Environment

- OS:
- FileOctopus version:
- Build or bundle path:
- Tester:
- Date:

Use a disposable directory such as `/tmp/fileoctopus-sprint-4`.

## Setup

```bash
rm -rf /tmp/fileoctopus-sprint-4
mkdir -p /tmp/fileoctopus-sprint-4/source /tmp/fileoctopus-sprint-4/destination
printf "alpha" > /tmp/fileoctopus-sprint-4/source/alpha.txt
printf "hidden" > /tmp/fileoctopus-sprint-4/source/.hidden-alpha
mkdir -p /tmp/fileoctopus-sprint-4/source/folder/nested
printf "needle" > /tmp/fileoctopus-sprint-4/source/folder/nested/needle.txt
```

## Pass/Fail Checklist

| Area          | Scenario                                                                                                         | Result | Blocker | Notes |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ------- | ----- |
| Navigation    | Sidebar Home and available user folders navigate the active panel                                                |        |         |       |
| Navigation    | Back, Forward, and Up update the path without corrupting selection                                               |        |         |       |
| Navigation    | Breadcrumb parent segment click navigates to that parent                                                         |        |         |       |
| Navigation    | `Ctrl/Cmd+L` focuses editable path entry; Escape cancels edit                                                    |        |         |       |
| File opening  | Double-click folder opens internally                                                                             |        |         |       |
| File opening  | Double-click file opens with OS default app or shows friendly error                                              |        |         |       |
| File list     | Details columns show name, size, modified, and type                                                              |        |         |       |
| File list     | Sorting by name, size, modified, and type toggles direction                                                      |        |         |       |
| View modes    | Details, list, and icons modes preserve current folder and selection                                             |        |         |       |
| Selection     | Click, Ctrl/Cmd-click, Shift-click, and Ctrl/Cmd+A behave predictably                                            |        |         |       |
| Clipboard     | Ctrl/Cmd+C, Ctrl/Cmd+X, and Ctrl/Cmd+V start copy/move into current folder                                       |        |         |       |
| Clipboard     | Copy Path and Copy Name write newline-delimited selected item text                                               |        |         |       |
| Context menu  | Item context menu exposes open, rename, copy, cut, paste, trash, delete, copy path, properties, and reveal       |        |         |       |
| Context menu  | Empty-space menu exposes paste, new folder, new file, refresh, select all, view, and sort                        |        |         |       |
| Creation      | New Folder rejects invalid names and handles collisions                                                          |        |         |       |
| Creation      | New File creates an empty file, refreshes, and selects it                                                        |        |         |       |
| Properties    | File properties show path, type, size, timestamps, hidden, and read-only fields                                  |        |         |       |
| Properties    | Folder properties calculate size and item count without freezing the app                                         |        |         |       |
| Hidden files  | Hidden files are hidden by default and appear after toggling Show Hidden                                         |        |         |       |
| Refresh       | F5/Ctrl/Cmd+R reloads current folder without adding history entry                                                |        |         |       |
| Watcher       | External file creation and deletion appear after watcher refresh                                                 |        |         |       |
| Search        | Current-folder filter narrows visible rows in all view modes                                                     |        |         |       |
| Search        | Recursive search finds `needle.txt` and supports open, reveal, and properties actions                            |        |         |       |
| Safety        | Delete Permanently requires explicit confirmation and lists affected count                                       |        |         |       |
| Errors        | Missing file, permission denied, name collision, no default app, and launch failure show user-facing messages    |        |         |       |
| Visual        | Light and dark themes keep sidebar, breadcrumb, views, menus, dialogs, search, status, and focus states readable |        |         |       |
| Accessibility | Core workflows above can be completed with keyboard focus visible                                                |        |         |       |

## Platform Notes

| OS      | Notes                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Windows | Verify drive roots, backslash path paste, invalid filename characters, Recycle Bin behavior, and default app launch. |
| macOS   | Verify `/Volumes`, Finder reveal, dotfile visibility, default app launch, and Command-key shortcuts.                 |
| Linux   | Verify `/`, `/mnt`, `/media`, dotfile visibility, `xdg-open`, and Trash availability.                                |

## Triage Policy

- Blocker: data loss, crash, destructive action without confirmation, navigation dead-end without recovery, or common file operations unusable.
- Minor defect: visual polish, unsupported platform integration with clear fallback, or non-critical metadata gaps.
