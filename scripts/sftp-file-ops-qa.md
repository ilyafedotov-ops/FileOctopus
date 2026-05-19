# SFTP file operations manual QA

Prerequisites: a reachable SFTP server, a saved profile in FileOctopus, and `pnpm dev`.

## Same-server (one profile)

- [ ] Create folder (F7) in remote pane
- [ ] Create empty file in remote pane
- [ ] Rename file and folder (F2)
- [ ] Copy file within remote tree (F5)
- [ ] Move file within remote tree (F6)
- [ ] Delete file/folder (F8) — permanent on remote
- [ ] Copy remote file to local pane (F5 → pick local destination)
- [ ] Copy local file to remote pane (F5 → pick network drive)

## Cross-profile (two SFTP servers)

- [ ] Copy file from profile A to profile B
- [ ] Move file from profile A to profile B

## Read-only server

- [ ] Connect to a read-only account: toolbar/context actions respect `canWrite` / `canDelete`
- [ ] Copy out of read-only remote still works when `canRead` is true

## Errors

- [ ] Disconnect mid-copy: job fails with a stable error code
- [ ] Destination conflict: dialog shows remote paths correctly
