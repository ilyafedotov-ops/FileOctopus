import type {
  NetworkConnectionStatusDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";
import { Button, cx, Icons } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useEffect, useRef, useState } from "react";
import { normalizeIpcError } from "@fileoctopus/ts-api";

interface NetworkLocationsDialogProps {
  open: boolean;
  profiles: NetworkProfileDto[];
  statuses: NetworkConnectionStatusDto[];
  onClose: () => void;
  onNavigate: (uri: string) => void;
  onConnect: (profileId: string) => Promise<void>;
  onDisconnect: (profileId: string) => Promise<void>;
  onAddServer: () => void;
  onEditServer: (profile: NetworkProfileDto) => void;
  onDeleteServer: (profileId: string) => void;
  onOpenTerminal: (profile: NetworkProfileDto) => void;
}

function statusLabel(status: NetworkConnectionStatusDto | undefined): string {
  if (!status) {
    return "Offline";
  }
  switch (status.status) {
    case "connected":
      return "Connected";
    case "error":
      return status.message ?? "Error";
    default:
      return "Offline";
  }
}

export function NetworkLocationsDialog({
  open,
  profiles,
  statuses,
  onClose,
  onNavigate,
  onConnect,
  onDisconnect,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onOpenTerminal,
}: NetworkLocationsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setActionError(null);
      setConnectingId(null);
    }
  }, [open]);

  async function handleConnect(profileId: string) {
    setActionError(null);
    setConnectingId(profileId);
    try {
      await onConnect(profileId);
    } catch (error) {
      setActionError(normalizeIpcError(error).message);
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDisconnect(profileId: string) {
    setActionError(null);
    setConnectingId(profileId);
    try {
      await onDisconnect(profileId);
    } catch (error) {
      setActionError(normalizeIpcError(error).message);
    } finally {
      setConnectingId(null);
    }
  }

  if (!open) {
    return null;
  }

  const statusById = new Map(statuses.map((item) => [item.profileId, item]));

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-network-locations-dialog"
        aria-labelledby="network-locations-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="network-locations-title">Network Locations</h2>
            <p>Connect to saved remote servers and browse network locations.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          {actionError ? (
            <p className="fo-dialog-error">{actionError}</p>
          ) : null}
          {profiles.length === 0 ? (
            <p className="fo-network-empty">No saved servers yet.</p>
          ) : (
            <ul className="fo-network-profile-list">
              {profiles.map((profile) => {
                const status = statusById.get(profile.id);
                const connected = status?.status === "connected";
                const busy = connectingId === profile.id;
                const browseable =
                  profile.scheme === "sftp" ||
                  profile.scheme === "smb" ||
                  profile.scheme === "s3";
                return (
                  <li key={profile.id} className="fo-network-profile-item">
                    <div className="fo-network-profile-main">
                      <span className="fo-network-profile-icon">
                        {Icons.volume()}
                      </span>
                      <div>
                        <div className="fo-network-profile-title">
                          {profile.label}
                        </div>
                        <div className="fo-network-profile-meta">
                          {profile.username}@{profile.host}:{profile.port}
                        </div>
                        <div
                          className={cx(
                            "fo-network-profile-status",
                            connected && "fo-network-profile-status-connected",
                            status?.status === "error" &&
                              "fo-network-profile-status-error",
                          )}
                        >
                          {statusLabel(status)}
                        </div>
                      </div>
                    </div>
                    <div className="fo-network-profile-actions">
                      {browseable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => {
                            void onNavigate(profile.defaultUri);
                            onClose();
                          }}
                        >
                          Open
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={browseable ? "ghost" : "default"}
                        onClick={() => {
                          onOpenTerminal(profile);
                          onClose();
                        }}
                      >
                        Open Terminal
                      </Button>
                      {(profile.scheme === "sftp" ||
                        profile.scheme === "smb" ||
                        profile.scheme === "s3") &&
                      connected ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handleDisconnect(profile.id)}
                        >
                          {busy ? "Disconnecting…" : "Disconnect"}
                        </Button>
                      ) : profile.scheme === "sftp" ||
                        profile.scheme === "smb" ||
                        profile.scheme === "s3" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handleConnect(profile.id)}
                        >
                          {busy ? "Connecting…" : "Connect"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditServer(profile)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteServer(profile.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="fo-dialog-footer">
          <Button type="button" onClick={onAddServer}>
            Add server
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
