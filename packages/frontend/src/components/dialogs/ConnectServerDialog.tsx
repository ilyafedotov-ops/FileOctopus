import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useEffect, useRef, useState } from "react";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface ConnectServerDialogProps {
  open: boolean;
  editingProfile: NetworkProfileDto | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    scheme: "sftp" | "ssh";
    label: string;
    host: string;
    port: number;
    username: string;
    authKind: "password" | "privateKey";
    privateKeyPath: string | null;
    defaultPath: string;
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileDto>;
  onForgetFingerprint?: (profileId: string) => Promise<void>;
}

export function ConnectServerDialog({
  open,
  editingProfile,
  onClose,
  onSave,
  onForgetFingerprint,
}: ConnectServerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);
  const [label, setLabel] = useState("");
  const [scheme, setScheme] = useState<"sftp" | "ssh">("sftp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authKind, setAuthKind] = useState<"password" | "privateKey">(
    "password",
  );
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [defaultPath, setDefaultPath] = useState("/");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLabel(editingProfile?.label ?? "");
    setScheme(editingProfile?.scheme === "ssh" ? "ssh" : "sftp");
    setHost(editingProfile?.host ?? "");
    setPort(String(editingProfile?.port ?? 22));
    setUsername(editingProfile?.username ?? "");
    setAuthKind(
      editingProfile?.authKind === "privateKey" ? "privateKey" : "password",
    );
    setPrivateKeyPath(editingProfile?.privateKeyPath ?? "");
    setDefaultPath(editingProfile?.defaultPath ?? "/");
    setPassword("");
    setPassphrase("");
    setError(null);
  }, [editingProfile, open]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    const trimmedLabel = label.trim();
    const trimmedHost = host.trim();
    const trimmedUsername = username.trim();
    const parsedPort = Number(port);

    if (!trimmedLabel || !trimmedHost || !trimmedUsername) {
      setError("Label, host, and username are required.");
      return;
    }

    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      setError("Enter a valid port.");
      return;
    }

    if (authKind === "privateKey" && !privateKeyPath.trim()) {
      setError("Private key path is required.");
      return;
    }

    if (authKind === "password" && !editingProfile && !password) {
      setError("Password is required for a new server.");
      return;
    }

    if (
      authKind === "password" &&
      editingProfile &&
      !editingProfile.hasStoredSecret &&
      !password
    ) {
      setError(
        "Password is not saved in the keychain yet. Enter it now to store credentials.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: editingProfile?.id,
        scheme,
        label: trimmedLabel,
        host: trimmedHost,
        port: parsedPort,
        username: trimmedUsername,
        authKind,
        privateKeyPath:
          authKind === "privateKey" ? privateKeyPath.trim() : null,
        defaultPath: scheme === "sftp" ? defaultPath.trim() || "/" : "",
        password,
        passphrase,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save server",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-connect-server-dialog"
        aria-labelledby="connect-server-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id="connect-server-title">
              {editingProfile ? "Edit Server" : "Add Server"}
            </h2>
            <p>
              Save a remote connection profile. Credentials stay in the OS
              keychain.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body fo-connect-server-form">
          <label className="fo-dialog-field">
            <span>Label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Production SFTP"
            />
          </label>
          <label className="fo-dialog-field">
            <span>Protocol</span>
            <select
              value={scheme}
              disabled={editingProfile !== null}
              onChange={(event) =>
                setScheme(event.target.value === "ssh" ? "ssh" : "sftp")
              }
            >
              <option value="sftp">SFTP files + SSH terminal</option>
              <option value="ssh">SSH terminal only</option>
            </select>
          </label>
          <label className="fo-dialog-field">
            <span>Host</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="example.com"
            />
          </label>
          <label className="fo-dialog-field">
            <span>Port</span>
            <input
              value={port}
              onChange={(event) => setPort(event.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="fo-dialog-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="deploy"
            />
          </label>
          <label className="fo-dialog-field">
            <span>Authentication</span>
            <select
              value={authKind}
              onChange={(event) =>
                setAuthKind(
                  event.target.value === "privateKey"
                    ? "privateKey"
                    : "password",
                )
              }
            >
              <option value="password">Password</option>
              <option value="privateKey">Private key</option>
            </select>
          </label>
          {authKind === "password" ? (
            <label className="fo-dialog-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  editingProfile
                    ? editingProfile.hasStoredSecret
                      ? "Leave blank to keep existing"
                      : "Enter password to save in keychain"
                    : ""
                }
              />
              {editingProfile && !editingProfile.hasStoredSecret ? (
                <span className="fo-settings-hint">
                  Credentials were not saved yet. Enter your password to
                  connect.
                </span>
              ) : null}
            </label>
          ) : (
            <>
              <label className="fo-dialog-field">
                <span>Private key path</span>
                <input
                  value={privateKeyPath}
                  onChange={(event) => setPrivateKeyPath(event.target.value)}
                  placeholder="/Users/you/.ssh/id_ed25519"
                />
              </label>
              <label className="fo-dialog-field">
                <span>Key passphrase</span>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder={
                    editingProfile ? "Leave blank to keep existing" : ""
                  }
                />
              </label>
            </>
          )}
          {scheme === "sftp" ? (
            <label className="fo-dialog-field">
              <span>Default path</span>
              <input
                value={defaultPath}
                onChange={(event) => setDefaultPath(event.target.value)}
                placeholder="/home/deploy"
              />
            </label>
          ) : null}
          {editingProfile?.hostKeyFingerprint ? (
            <div className="fo-dialog-field fo-dialog-field-static">
              <span>Pinned host key</span>
              <code
                className="fo-fingerprint-display"
                title={editingProfile.hostKeyFingerprint}
              >
                {editingProfile.hostKeyFingerprint}
              </code>
              {onForgetFingerprint ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (editingProfile?.id) {
                      void onForgetFingerprint(editingProfile.id);
                    }
                  }}
                >
                  Forget pinned fingerprint
                </Button>
              ) : null}
              <span className="fo-settings-hint">
                The next successful connect will pin the server&apos;s current
                fingerprint.
              </span>
            </div>
          ) : editingProfile ? (
            <p className="fo-settings-hint">
              No host key pinned yet. The fingerprint shown by the server on the
              next connect will be remembered.
            </p>
          ) : null}
          {error ? <p className="fo-dialog-error">{error}</p> : null}
        </div>
        <footer className="fo-dialog-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving
              ? "Saving…"
              : editingProfile
                ? "Save changes"
                : "Add server"}
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
