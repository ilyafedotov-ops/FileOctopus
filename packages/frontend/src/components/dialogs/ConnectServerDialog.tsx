import type {
  NetworkConnectionDraftDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useEffect, useState } from "react";
import { WizardShell } from "../WizardShell";

type SchemeType = "sftp" | "ssh" | "smb" | "s3" | "webdav";
type AuthKindType = "password" | "privateKey" | "accessKey";
type WizardStep = "target" | "credentials" | "test" | "save";

const STEP_ORDER: WizardStep[] = ["target", "credentials", "test", "save"];
const STEP_LABELS = ["Target", "Credentials", "Test", "Save"];

interface ConnectServerDialogProps {
  open: boolean;
  editingProfile: NetworkProfileDto | null;
  initialDraft?: NetworkConnectionDraftDto | null;
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
  if (scheme === "webdav") return 443;
  return 22;
}

function defaultAuthKinds(scheme: SchemeType): AuthKindType[] {
  if (scheme === "sftp" || scheme === "ssh") return ["password", "privateKey"];
  if (scheme === "smb") return ["password"];
  if (scheme === "s3") return ["accessKey"];
  if (scheme === "webdav") return ["password"];
  return ["password"];
}

function defaultAuthKind(scheme: SchemeType): AuthKindType {
  return defaultAuthKinds(scheme)[0];
}

export function ConnectServerDialog({
  open,
  editingProfile,
  initialDraft,
  onClose,
  onSave,
  onForgetFingerprint,
}: ConnectServerDialogProps) {
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
  const [step, setStep] = useState<WizardStep>("target");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const candidateScheme =
      editingProfile?.scheme ?? initialDraft?.scheme ?? "sftp";
    const profileScheme = (
      ["sftp", "ssh", "smb", "s3", "webdav"].indexOf(candidateScheme) !== -1
        ? candidateScheme
        : "sftp"
    ) as SchemeType;
    setLabel(editingProfile?.label ?? initialDraft?.label ?? "");
    setScheme(profileScheme);
    setHost(editingProfile?.host ?? initialDraft?.host ?? "");
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
    setDefaultPath(
      editingProfile?.defaultPath ?? initialDraft?.defaultPath ?? "/",
    );
    setPassword("");
    setPassphrase("");
    setStep("target");
    setTestStatus(null);
    setError(null);
  }, [editingProfile, initialDraft, open]);

  function handleSchemeChange(newScheme: SchemeType) {
    setScheme(newScheme);
    setPort(String(defaultPort(newScheme)));
    setAuthKind(defaultAuthKind(newScheme));
    setDefaultPath("/");
  }

  const showPasswordField = authKind === "password" || authKind === "accessKey";
  const showPrivateKeyField = authKind === "privateKey";
  const showDefaultPath =
    scheme === "sftp" || scheme === "smb" || scheme === "webdav";
  const showBucketField = scheme === "s3";
  const authKinds = defaultAuthKinds(scheme);

  const hostLabel = scheme === "s3" ? "Endpoint URL" : "Host";
  const hostPlaceholder =
    scheme === "s3"
      ? "s3.amazonaws.com or minio.local:9000"
      : scheme === "webdav"
        ? "https://files.example.com"
        : "example.com";
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
        : scheme === "webdav"
          ? "/remote.php/dav/files/user"
          : "/home/deploy";
  const stepIndex = STEP_ORDER.indexOf(step);

  function credentialsError(): string | null {
    const trimmedUsername = username.trim();
    if (scheme !== "s3" && !trimmedUsername) {
      return "Username is required.";
    }
    if (authKind === "privateKey" && !privateKeyPath.trim()) {
      return "Private key path is required.";
    }
    if (showPasswordField && !editingProfile && !password) {
      return `${passwordLabel} is required for a new server.`;
    }
    return null;
  }

  function handleNextStep() {
    setError(null);
    if (step === "target") {
      if (!label.trim() || !host.trim()) {
        setError("Label and host are required.");
        return;
      }
      const parsedPort = Number(port);
      if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
        setError("Enter a valid port.");
        return;
      }
      setStep("credentials");
      return;
    }
    if (step === "credentials") {
      const credError = credentialsError();
      if (credError) {
        setError(credError);
        return;
      }
      setStep("test");
      return;
    }
    if (step === "test") {
      setTestStatus("Connection details are ready to save.");
      setStep("save");
    }
  }

  function handlePreviousStep() {
    setError(null);
    const prev = STEP_ORDER[Math.max(0, stepIndex - 1)];
    setStep(prev);
  }

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

  const primaryLabel =
    step === "save"
      ? saving
        ? "Saving…"
        : editingProfile
          ? "Save changes"
          : "Save connection"
      : step === "test"
        ? "Test"
        : "Next";

  return (
    <WizardShell
      open={open}
      onClose={onClose}
      title={editingProfile ? "Edit Server" : "Add Server"}
      subtitle="Save a remote connection profile. Credentials stay in the OS keychain."
      className="fo-connect-server-dialog"
      steps={STEP_LABELS}
      currentStep={stepIndex}
      onStepSelect={(index) => {
        setError(null);
        setStep(STEP_ORDER[index]);
      }}
      onBack={handlePreviousStep}
      onPrimary={() => {
        if (step === "save") {
          void handleSubmit();
        } else {
          handleNextStep();
        }
      }}
      primaryLabel={primaryLabel}
      primaryDisabled={saving}
      error={error}
    >
      <div className="fo-connect-server-form">
        {step === "target" ? (
          <>
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
                <option value="webdav">WebDAV</option>
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
            {showDefaultPath || showBucketField ? (
              <label className="fo-dialog-field">
                <span>{defaultPathLabel}</span>
                <input
                  value={defaultPath}
                  onChange={(event) => setDefaultPath(event.target.value)}
                  placeholder={defaultPathPlaceholder}
                />
              </label>
            ) : null}
          </>
        ) : null}

        {step === "credentials" ? (
          <>
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
          </>
        ) : null}

        {step === "test" || step === "save" ? (
          <dl className="fo-detail-grid fo-connect-summary">
            <dt>Label</dt>
            <dd>{label || "—"}</dd>
            <dt>Protocol</dt>
            <dd>{scheme.toUpperCase()}</dd>
            <dt>{hostLabel}</dt>
            <dd>
              {host || "—"}:{port}
            </dd>
            <dt>{usernameLabel}</dt>
            <dd>{username || "—"}</dd>
            <dt>{defaultPathLabel}</dt>
            <dd>{defaultPath || "/"}</dd>
          </dl>
        ) : null}

        {step === "test" || step === "save" ? (
          editingProfile?.hostKeyFingerprint ? (
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
          ) : null
        ) : null}

        {testStatus ? <p className="fo-settings-hint">{testStatus}</p> : null}
      </div>
    </WizardShell>
  );
}
