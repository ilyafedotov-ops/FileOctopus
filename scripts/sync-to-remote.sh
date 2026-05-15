#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/home/ilya/Documents/FileOctupus"
REMOTE_HOST="ilya@192.168.88.141"
REMOTE_DIR="~/FileOctupus"

EXCLUDES=(
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='target/'
  --exclude='.claude/'
  --exclude='dist/'
  --exclude='.cache/'
  --exclude='*.log'
  --exclude='.DS_Store'
  --exclude='*.tmp'
  --exclude='*.swp'
  --exclude='*.swo'
)

DRY_RUN=false
REMOVE_STALE=false

usage() {
  echo "Usage: $(basename "$0") [options]"
  echo ""
  echo "Sync FileOctopus project to remote host via rsync/ssh."
  echo ""
  echo "Options:"
  echo "  -n, --dry-run      Show what would be transferred without copying"
  echo "  -r, --remove       Remove stale .git, node_modules, target, .claude on remote first"
  echo "  -h, --help         Show this help message"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -r|--remove)
      REMOVE_STALE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

if [[ "$REMOVE_STALE" == true ]]; then
  echo "Removing stale directories on remote..."
  ssh "$REMOTE_HOST" "cd $REMOTE_DIR && rm -rf .git node_modules target .claude 2>/dev/null || true"
  echo "Done."
fi

RSYNC_FLAGS=(-avz --delete)

if [[ "$DRY_RUN" == true ]]; then
  RSYNC_FLAGS+=(--dry-run)
  echo "=== DRY RUN ==="
fi

echo "Syncing $SOURCE_DIR -> $REMOTE_HOST:$REMOTE_DIR"

rsync "${RSYNC_FLAGS[@]}" \
  "${EXCLUDES[@]}" \
  "$SOURCE_DIR/" \
  "$REMOTE_HOST:$REMOTE_DIR/"

echo "Sync complete."
