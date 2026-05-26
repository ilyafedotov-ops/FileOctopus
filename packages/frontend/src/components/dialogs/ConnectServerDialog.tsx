import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useEffect, useRef, useState } from "react";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

type SchemeType = "sftp" | "ssh" | "smb" | "s3";
type AuthKindType = "password" | "privateKey" | "accessKey";

interface ConnectServerDialogProps {
  open: boolean;
  editingProfile: NetworkProfileDto | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    scheme: SchemeType;
    label: string;
    host: string;
    port: number;
    username: string;
    authKind: AuthKindType;
    privateKeyPath: string | null;
    defaultPath: string;
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileDto>;
  onForgetFingerprint?: (profileId: string) => Promise<void>;
}

function defaultPort(scheme: SchemeType): number {
  if (scheme === "sftp" || scheme === "ssh") return 22;
  if (scheme === "smb") return 445;
  if (scheme === "s3") return 443;
  return 22;
}

function defaultAuthKinds(scheme: SchemeType): AuthKindType[] {
  if (scheme === "sftp" || scheme === "ssh") return ["password", "privateKey"];
  if (scheme === "smb") return ["password"];
  if (scheme === "s3") return ["accessKey"];
  return ["password"];
}

function defaultAuthKind(scheme: SchemeType): AuthKindType {
  return defaultAuthKinds(scheme)[0];
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
  const [scheme, setScheme] = useState<SchemeType>("sftp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authKind, setAuthKind] = useState<AuthKindType>("password");
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
    const profileScheme = (
      ["sftp", "ssh", "smb", "s3"].indexOf(editingProfile?.scheme ?? "sftp") !==
      -1
        ? editingProfile?.scheme
        : "sftp"
    ) as SchemeType;
    setLabel(editingProfile?.label ?? "");
    setScheme(profileScheme);
    setHost(editingProfile?.host ?? "");
    setPort(String(editingProfile?.port ?? defaultPort(profileScheme)));
    setUsername(editingProfile?.username ?? "");
    const profileAuth = editingProfile?.authKind;
    const validAuthKinds = defaultAuthKinds(profileScheme);
    setAuthKind(
      profileAuth && validAuthKinds.indexOf(profileAuth as AuthKindType) !== -1
        ? (profileAuth as AuthKindType)
        : defaultAuthKind(profileScheme),
    );
    setPrivateKeyPath(editingProfile?.privateKeyPath ?? "");
    setDefaultPath(editingProfile?.defaultPath ?? "/");
    setPassword("");
    setPassphrase("");
    setError(null);
  }, [editingProfile, open]);

  function handleSchemeChange(newScheme: SchemeType) {
    setScheme(newScheme);
    setPort(String(defaultPort(newScheme)));
    setAuthKind(defaultAuthKind(newScheme));
    if (newScheme === "s3") {
      setDefaultPath("/");
    } else if (newScheme === "smb") {
      setDefaultPath("/");
    }
  }

  if (!open) {
    return null;
  }

  const showPasswordField = authKind === "password" || authKind === "accessKey";
  const showPrivateKeyField = authKind === "privateKey";
  const showDefaultPath = scheme === "sftp" || scheme === "smb";
  const showBucketField = scheme === "s3";
  const authKinds = defaultAuthKinds(scheme);

  const hostLabel = scheme === "s3" ? "Endpoint URL" : "Host";
  const hostPlaceholder =
    scheme === "s3" ? "s3.amazonaws.com or minio.local:9000" : "example.com";
  const usernameLabel = scheme === "s3" ? "Access Key ID" : "Username";
  const usernamePlaceholder =
    scheme === "s3" ? "AKIAIOSFODNN7EXAMPLE" : "deploy";
  const passwordLabel =
    authKind === "accessKey" ? "Secret Access Key" : "Password";
  const defaultPathLabel = scheme === "s3" ? "Bucket" : "Default path";
  const defaultPathPlaceholder =
    scheme === "s3"
      ? "my-bucket"
      : scheme === "smb"
        ? "/share"
        : "/home/deploy";

  async function handleSubmit() {
    const trimmedLabel = label.trim();
    const trimmedHost = host.trim();
    const trimmedUsername = username.trim();
    const parsedPort = Number(port);

    if (!trimmedLabel || !trimmedHost) {
      setError("Label and host are required.");
      return;
    }

    if (scheme !== "s3" && !trimmedUsername) {
      setError("Username is required.");
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

    if (showPasswordField && !editingProfile && !password) {
      setError(`${passwordLabel} is required for a new server.`);
      return;
    }

    if (
      showPasswordField &&
      editingProfile &&
      !editingProfile.hasStoredSecret &&
      !password
    ) {
      setError(
        `${passwordLabel} is not saved in the keychain yet. Enter it now to store credentials.`,
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
        defaultPath: defaultPath.trim() || "/",
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
              placeholder={
                scheme === "s3"
                  ? "Production S3"
                  : scheme === "smb"
                    ? "File Server"
                    : "Production SFTP"
              }
            />
          </label>
          <label className="fo-dialog-field">
            <span>Protocol</span>
            <select
              value={scheme}
              disabled={editingProfile !== null}
              onChange={(event) =>
                handleSchemeChange(event.target.value as SchemeType)
              }
            >
              <option value="sftp">SFTP files + SSH terminal</option>
              <option value="ssh">SSH terminal only</option>
              <option value="smb">SMB / CIFS share</option>
              <option value="s3">S3 object storage</option>
            </select>
          </label>
          <label className="fo-dialog-field">
            <span>{hostLabel}</span>
            <input
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder={hostPlaceholder}
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
            <span>{usernameLabel}</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={usernamePlaceholder}
            />
          </label>
          {authKinds.length > 1 ? (
            <label className="fo-dialog-field">
              <span>Authentication</span>
              <select
                value={authKind}
                onChange={(event) =>
                  setAuthKind(event.target.value as AuthKindType)
                }
              >
                <option value="password">Password</option>
                <option value="privateKey">Private key</option>
              </select>
            </label>
          ) : null}
          {showPasswordField ? (
            <label className="fo-dialog-field">
              <span>{passwordLabel}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  editingProfile
                    ? editingProfile.hasStoredSecret
                      ? "Leave blank to keep existing"
                      : `Enter ${passwordLabel.toLowerCase()} to save in keychain`
                    : ""
                }
              />
              {editingProfile && !editingProfile.hasStoredSecret ? (
                <span className="fo-settings-hint">
                  Credentials were not saved yet. Enter your{" "}
                  {passwordLabel.toLowerCase()} to connect.
                </span>
              ) : null}
            </label>
          ) : null}
          {showPrivateKeyField ? (
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
          ) : null}
          {showDefaultPath ? (
            <label className="fo-dialog-field">
              <span>{defaultPathLabel}</span>
              <input
                value={defaultPath}
                onChange={(event) => setDefaultPath(event.target.value)}
                placeholder={defaultPathPlaceholder}
              />
            </label>
          ) : null}
          {showBucketField ? (
            <label className="fo-dialog-field">
              <span>{defaultPathLabel}</span>
              <input
                value={defaultPath}
                onChange={(event) => setDefaultPath(event.target.value)}
                placeholder={defaultPathPlaceholder}
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
