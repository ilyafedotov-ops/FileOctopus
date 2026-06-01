import { Button } from "@fileoctopus/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NetworkProfileDto, VolumeDto } from "@fileoctopus/ts-api";
import type { SmartFolder } from "../savedSearches";

export function SidebarContextMenu({
  x,
  y,
  onClose,
  onRename,
  onRemove,
  onReveal,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
  onReveal: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-sidebar-context-menu"
        role="menu"
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRename)}
        >
          Rename Favorite
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRemove)}
        >
          Remove Favorite
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onReveal)}
        >
          Reveal Path
        </Button>
      </div>
    </div>
  );
}

export function SidebarNetworkContextMenu({
  profile,
  connected,
  x,
  y,
  onClose,
  onConnect,
  onDisconnect,
  onEdit,
  onRemove,
  onOpenTerminal,
  onAddFavorite,
}: {
  profile: NetworkProfileDto;
  connected: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onOpenTerminal: () => void;
  onAddFavorite: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-sidebar-context-menu"
        role="menu"
        aria-label={`${profile.label} actions`}
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onOpenTerminal)}
        >
          Open Terminal
        </Button>
        {(profile.scheme === "sftp" ||
          profile.scheme === "smb" ||
          profile.scheme === "s3") &&
        connected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onDisconnect)}
          >
            Disconnect
          </Button>
        ) : profile.scheme === "sftp" ||
          profile.scheme === "smb" ||
          profile.scheme === "s3" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onConnect)}
          >
            Connect
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onEdit)}
        >
          Edit
        </Button>
        {profile.scheme === "sftp" ||
        profile.scheme === "smb" ||
        profile.scheme === "s3" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onAddFavorite)}
          >
            Add to Favorites
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRemove)}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function SidebarVolumeContextMenu({
  volume,
  x,
  y,
  onClose,
  onEject,
}: {
  volume: VolumeDto;
  x: number;
  y: number;
  onClose: () => void;
  onEject: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-context-menu"
        role="menu"
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
      >
        <div className="fo-context-menu-group">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="fo-context-menu-item"
            role="menuitem"
            onClick={() => run(onEject)}
          >
            Eject {volume.name}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SidebarSmartFolderContextMenu({
  folder,
  x,
  y,
  onClose,
  onRename,
  onRemove,
}: {
  folder: SmartFolder;
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [x, y]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fo-sidebar-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-sidebar-context-menu"
        role="menu"
        aria-label={`${folder.name} actions`}
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: x, top: y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRename)}
        >
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item"
          role="menuitem"
          onClick={() => run(onRemove)}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
