# Sprint 5 macOS manual QA checklist

## Sidebar and standard locations

- [ ] Home opens under Favorites
- [ ] Desktop, Documents, Downloads, Pictures, Music, and Videos open when present
- [ ] `/Volumes` lists mounted volumes without Time Machine backup entries breaking navigation
- [ ] Inaccessible volumes do not crash the sidebar

## Pane loading states

- [ ] Empty folders show the empty-state panel with refresh and new-folder actions
- [ ] Permission-denied paths show the permission state with retry
- [ ] Rapid navigation does not show stale entries from the previous path
- [ ] Slow or blocked paths surface a timeout or error instead of an endless loader

## Layout and preferences

- [ ] Diagnostics open from Help and are not visible in the main layout by default
- [ ] Settings change theme, density, default view mode, and hidden-file default
- [ ] Toolbar primary actions remain visible and overflow actions are reachable
- [ ] Status bar reports pane state, selection count, entry count, and active jobs

## Shortcuts and operations

- [ ] Tab switches panes
- [ ] Cmd/Ctrl+L focuses the path bar
- [ ] Cmd/Ctrl+F focuses the filter field
- [ ] Cmd/Ctrl+N opens new-folder flow
- [ ] Completed and failed file operations show toast feedback
