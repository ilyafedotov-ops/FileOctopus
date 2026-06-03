import type {
  FsClient,
  NetworkConnectionDraftDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";
import { remotePathFromUri, rootUriForUri } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useEffect, useState } from "react";
import { WizardShell } from "../WizardShell";
import { PathBrowseField } from "../PathBrowseField";
import { DialogShell } from "../DialogShell";
import { FolderTree } from "../../dialogs/FolderTree";
import {
  pickLocalPath as defaultPickLocalPath,
  SSH_KEY_FILTERS,
  type LocalPathPicker,
} from "../../utils/pathPicker";

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
  onTest?: (profileId: string) => Promise<{ ok: boolean; message: string }>;
  pickLocalPath?: LocalPathPicker;
  fs?: FsClient;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

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
  onTest,
  pickLocalPath = defaultPickLocalPath,
  fs,
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
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [remotePathPickerOpen, setRemotePathPickerOpen] = useState(false);

  const clearFieldError = (field: string) => {
    setInvalidFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

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
    setTestState({ status: "idle" });
    setError(null);
    setInvalidFields(new Set());
    setRemotePathPickerOpen(false);
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
  const canBrowseRemoteDefaultPath =
    Boolean(fs) &&
    editingProfile !== null &&
    showDefaultPath &&
    (scheme === "sftp" || scheme === "smb" || scheme === "webdav");
  const remoteDefaultPathRootUri =
    editingProfile && canBrowseRemoteDefaultPath
      ? rootUriForUri(editingProfile.defaultUri)
      : null;

  async function browsePrivateKeyPath() {
    const selected = await pickLocalPath({
      kind: "file",
      currentPath: privateKeyPath,
      title: "Choose private key",
      filters: SSH_KEY_FILTERS,
    });
    if (selected) {
      setPrivateKeyPath(selected);
    }
  }

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
      const invalid = new Set<string>();
      if (!label.trim()) invalid.add("label");
      if (!host.trim()) invalid.add("host");
      const parsedPort = Number(port);
      if (!Number.isFinite(parsedPort) || parsedPort <= 0) invalid.add("port");
      if (invalid.size > 0) {
        setInvalidFields(invalid);
        setError(
          invalid.has("port") && invalid.size === 1
            ? "Enter a valid port."
            : "Label and host are required.",
        );
        return;
      }
      setInvalidFields(new Set());
      setStep("credentials");
      return;
    }
    if (step === "credentials") {
      const invalid = new Set<string>();
      if (scheme !== "s3" && !username.trim()) invalid.add("username");
      if (authKind === "privateKey" && !privateKeyPath.trim())
        invalid.add("privateKey");
      if (showPasswordField && !editingProfile && !password)
        invalid.add("password");
      const credError = credentialsError();
      if (credError) {
        setInvalidFields(invalid);
        setError(credError);
        return;
      }
      setInvalidFields(new Set());
      setStep("test");
      return;
    }
    if (step === "test") {
      setStep("save");
    }
  }

  async function runTest() {
    if (!onTest || !editingProfile?.id) return;
    setTestState({ status: "testing" });
    try {
      const result = await onTest(editingProfile.id);
      setTestState({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (testError) {
      setTestState({
        status: "error",
        message:
          testError instanceof Error
            ? testError.message
            : "Connection test failed.",
      });
    }
  }

  const canRunTest = Boolean(onTest) && editingProfile !== null;

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
                aria-invalid={invalidFields.has("label") || undefined}
                className={
                  invalidFields.has("label") ? "fo-field-invalid" : undefined
                }
                onChange={(event) => {
                  setLabel(event.target.value);
                  clearFieldError("label");
                }}
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
                aria-invalid={invalidFields.has("host") || undefined}
                className={
                  invalidFields.has("host") ? "fo-field-invalid" : undefined
                }
                onChange={(event) => {
                  setHost(event.target.value);
                  clearFieldError("host");
                }}
                placeholder={hostPlaceholder}
              />
            </label>
            <label className="fo-dialog-field">
              <span>Port</span>
              <input
                value={port}
                aria-invalid={invalidFields.has("port") || undefined}
                className={
                  invalidFields.has("port") ? "fo-field-invalid" : undefined
                }
                onChange={(event) => {
                  setPort(event.target.value);
                  clearFieldError("port");
                }}
                inputMode="numeric"
              />
            </label>
            {showDefaultPath || showBucketField ? (
              canBrowseRemoteDefaultPath ? (
                <PathBrowseField
                  className="fo-dialog-field"
                  label={defaultPathLabel}
                  value={defaultPath}
                  placeholder={defaultPathPlaceholder}
                  browseLabel="Browse default path"
                  onChange={setDefaultPath}
                  onBrowse={() => setRemotePathPickerOpen(true)}
                />
              ) : (
                <label className="fo-dialog-field">
                  <span>{defaultPathLabel}</span>
                  <input
                    aria-label={defaultPathLabel}
                    value={defaultPath}
                    onChange={(event) => setDefaultPath(event.target.value)}
                    placeholder={defaultPathPlaceholder}
                  />
                  {showDefaultPath ? (
                    <span className="fo-settings-hint">
                      Save the connection before browsing remote folders.
                    </span>
                  ) : null}
                </label>
              )
            ) : null}
          </>
        ) : null}

        {step === "credentials" ? (
          <>
            <label className="fo-dialog-field">
              <span>{usernameLabel}</span>
              <input
                value={username}
                aria-invalid={invalidFields.has("username") || undefined}
                className={
                  invalidFields.has("username") ? "fo-field-invalid" : undefined
                }
                onChange={(event) => {
                  setUsername(event.target.value);
                  clearFieldError("username");
                }}
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
                  aria-invalid={invalidFields.has("password") || undefined}
                  className={
                    invalidFields.has("password")
                      ? "fo-field-invalid"
                      : undefined
                  }
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError("password");
                  }}
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
                <PathBrowseField
                  className="fo-dialog-field"
                  label="Private key path"
                  value={privateKeyPath}
                  placeholder="/Users/you/.ssh/id_ed25519"
                  browseLabel="Browse private key path"
                  onChange={setPrivateKeyPath}
                  onBrowse={() => void browsePrivateKeyPath()}
                />
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

        {step === "test" ? (
          <div className="fo-connect-test">
            {canRunTest ? (
              <>
                <div className="fo-connect-test-row">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={testState.status === "testing"}
                    onClick={() => void runTest()}
                  >
                    {testState.status === "testing"
                      ? "Testing…"
                      : "Run connection test"}
                  </Button>
                  {testState.status === "testing" ? (
                    <span
                      className="fo-connect-test-spinner"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                {testState.status === "success" ? (
                  <p
                    className="fo-connect-test-card fo-connect-test-card--ok"
                    role="status"
                  >
                    {testState.message}
                  </p>
                ) : testState.status === "error" ? (
                  <p
                    className="fo-connect-test-card fo-connect-test-card--error"
                    role="alert"
                  >
                    {testState.message}
                  </p>
                ) : (
                  <p className="fo-settings-hint">
                    Verify the server is reachable with the saved credentials
                    before saving.
                  </p>
                )}
              </>
            ) : (
              <p className="fo-settings-hint">
                Save the connection to run a live test with these credentials.
              </p>
            )}
          </div>
        ) : testState.status === "success" ? (
          <p
            className="fo-connect-test-card fo-connect-test-card--ok"
            role="status"
          >
            {testState.message}
          </p>
        ) : testState.status === "error" ? (
          <p
            className="fo-connect-test-card fo-connect-test-card--error"
            role="status"
          >
            {testState.message}
          </p>
        ) : null}
      </div>
      <DialogShell
        open={remotePathPickerOpen && remoteDefaultPathRootUri !== null}
        onClose={() => setRemotePathPickerOpen(false)}
        title="Choose Default Path"
        subtitle={editingProfile?.label}
        size="md"
        className="fo-remote-path-picker-dialog"
      >
        <div className="fo-dialog-body">
          {fs && remoteDefaultPathRootUri ? (
            <FolderTree
              fs={fs}
              rootUri={remoteDefaultPathRootUri}
              rootLabel="/"
              onSelect={(uri) => {
                const selectedPath = remotePathFromUri(uri);
                if (selectedPath) {
                  setDefaultPath(selectedPath);
                }
                setRemotePathPickerOpen(false);
              }}
            />
          ) : null}
        </div>
      </DialogShell>
    </WizardShell>
  );
}
