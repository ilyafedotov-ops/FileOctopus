import type {
  FsClient,
  NetworkConnectionDraftDto,
  NetworkProfileTestResponse,
  NetworkProtocolOptionsDto,
  NetworkProviderCapabilityDto,
  NetworkProfileDto,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  displayPathFromUri,
  remotePathFromUri,
  rootUriForUri,
} from "@fileoctopus/ts-api";
import { Button, Icons, cx } from "@fileoctopus/ui";
import { useEffect, useMemo, useState } from "react";
import { PathBrowseField } from "../PathBrowseField";
import { DialogShell } from "../DialogShell";
import { FolderTree } from "../../dialogs/FolderTree";
import {
  pickLocalPath as defaultPickLocalPath,
  type LocalPathPicker,
} from "../../utils/pathPicker";

type SchemeType = "sftp" | "ssh" | "smb" | "s3" | "webdav";
type AuthKindType = "password" | "privateKey" | "accessKey";
type ConnectTab = "general" | "ssh" | "smb" | "s3" | "test";

const SSH_KEY_NAMES = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"];

const DEFAULT_PROVIDER_CAPABILITIES: NetworkProviderCapabilityDto[] = [
  {
    scheme: "sftp",
    label: "SFTP",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: true,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: [
      "useAgent",
      "sshConfigHost",
      "proxyJump",
      "proxyCommand",
      "keepaliveSecs",
      "compression",
      "addressFamily",
    ],
  },
  {
    scheme: "ssh",
    label: "SSH",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: false,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: [
      "useAgent",
      "sshConfigHost",
      "proxyJump",
      "proxyCommand",
      "keepaliveSecs",
      "compression",
      "addressFamily",
      "terminalInitialCommand",
      "terminalEnv",
    ],
  },
  {
    scheme: "smb",
    label: "SMB / CIFS",
    category: "server",
    defaultPort: 445,
    authKinds: ["password"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["workgroup", "minProtocol", "signingMode", "sharePath"],
  },
  {
    scheme: "s3",
    label: "S3",
    category: "server",
    defaultPort: 443,
    authKinds: ["accessKey"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["region", "useTls", "pathStyle", "rootPrefix"],
  },
  {
    scheme: "webdav",
    label: "WebDAV",
    category: "server",
    defaultPort: 443,
    authKinds: ["password"],
    fileCapable: false,
    terminalCapable: false,
    status: "unavailable",
    missingDependency: "WebDAV provider is not registered yet.",
    supportedOptions: [],
  },
];

interface ConnectServerDialogProps {
  open: boolean;
  editingProfile: NetworkProfileDto | null;
  initialDraft?: NetworkConnectionDraftDto | null;
  networkProfiles?: NetworkProfileDto[];
  providerCapabilities?: NetworkProviderCapabilityDto[];
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
    options: NetworkProtocolOptionsDto;
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileDto>;
  onConnectProfile?: (profile: NetworkProfileDto) => void;
  onForgetFingerprint?: (profileId: string) => Promise<void>;
  onTest?: (profileId: string) => Promise<{ ok: boolean; message: string }>;
  onTestDraft?: (payload: {
    scheme: SchemeType;
    label: string;
    host: string;
    port: number;
    username: string;
    authKind: AuthKindType;
    privateKeyPath: string | null;
    defaultPath: string;
    options: NetworkProtocolOptionsDto;
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileTestResponse>;
  preferences?: UserPreferencesDto;
  locations?: StandardLocationDto[];
  pickLocalPath?: LocalPathPicker;
  fs?: FsClient;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | {
      status: "success";
      message: string;
      durationMs?: number | null;
      resolvedUri?: string | null;
      fingerprint?: string | null;
      trustState?: string | null;
      warnings?: string[];
    }
  | {
      status: "error";
      message: string;
      durationMs?: number | null;
      resolvedUri?: string | null;
      fingerprint?: string | null;
      trustState?: string | null;
      warnings?: string[];
    };

function providerFor(
  providers: NetworkProviderCapabilityDto[],
  scheme: SchemeType,
): NetworkProviderCapabilityDto | undefined {
  return providers.find((provider) => provider.scheme === scheme);
}

function defaultPort(
  scheme: SchemeType,
  providers: NetworkProviderCapabilityDto[],
): number {
  return (
    providerFor(providers, scheme)?.defaultPort ?? (scheme === "smb" ? 445 : 22)
  );
}

function defaultAuthKinds(
  scheme: SchemeType,
  providers: NetworkProviderCapabilityDto[],
): AuthKindType[] {
  const kinds = providerFor(providers, scheme)?.authKinds.filter(
    (kind): kind is AuthKindType =>
      kind === "password" || kind === "privateKey" || kind === "accessKey",
  );
  if (kinds?.length) return kinds;
  if (scheme === "s3") return ["accessKey"];
  if (scheme === "sftp" || scheme === "ssh") return ["password", "privateKey"];
  return ["password"];
}

function defaultAuthKind(
  scheme: SchemeType,
  providers: NetworkProviderCapabilityDto[],
): AuthKindType {
  return defaultAuthKinds(scheme, providers)[0] ?? "password";
}

function protocolLabel(scheme: string): string {
  if (scheme === "sftp") return "SFTP";
  if (scheme === "ssh") return "SSH";
  if (scheme === "smb") return "SMB";
  if (scheme === "s3") return "S3";
  if (scheme === "webdav") return "WebDAV";
  return scheme.toUpperCase();
}

function providerMode(
  provider: NetworkProviderCapabilityDto | undefined,
): string {
  if (!provider) return "Saved profile";
  if (provider.fileCapable && provider.terminalCapable)
    return "Files + terminal";
  if (provider.fileCapable) return "Files";
  if (provider.terminalCapable) return "Terminal only";
  return "Unavailable";
}

export function ConnectServerDialog({
  open,
  editingProfile,
  initialDraft,
  networkProfiles = [],
  providerCapabilities = DEFAULT_PROVIDER_CAPABILITIES,
  onClose,
  onSave,
  onConnectProfile,
  onForgetFingerprint,
  onTest,
  onTestDraft,
  preferences,
  locations = [],
  pickLocalPath = defaultPickLocalPath,
  fs,
}: ConnectServerDialogProps) {
  const providers = providerCapabilities.length
    ? providerCapabilities
    : DEFAULT_PROVIDER_CAPABILITIES;
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<ConnectTab>("general");
  const [label, setLabel] = useState("");
  const [scheme, setScheme] = useState<SchemeType>("sftp");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authKind, setAuthKind] = useState<AuthKindType>("password");
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [defaultPath, setDefaultPath] = useState("/");
  const [useAgent, setUseAgent] = useState(false);
  const [sshConfigHost, setSshConfigHost] = useState("");
  const [proxyJump, setProxyJump] = useState("");
  const [proxyCommand, setProxyCommand] = useState("");
  const [keepaliveSecs, setKeepaliveSecs] = useState("");
  const [compression, setCompression] = useState(false);
  const [addressFamily, setAddressFamily] = useState("auto");
  const [terminalInitialCommand, setTerminalInitialCommand] = useState("");
  const [smbWorkgroup, setSmbWorkgroup] = useState("");
  const [smbMinProtocol, setSmbMinProtocol] = useState("");
  const [smbSigningMode, setSmbSigningMode] = useState("default");
  const [smbSharePath, setSmbSharePath] = useState("");
  const [s3Region, setS3Region] = useState("");
  const [s3UseTls, setS3UseTls] = useState(true);
  const [s3PathStyle, setS3PathStyle] = useState(false);
  const [s3RootPrefix, setS3RootPrefix] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const [detectedSshKeys, setDetectedSshKeys] = useState<string[]>([]);
  const [detectingSshKeys, setDetectingSshKeys] = useState(false);
  const [localProfiles, setLocalProfiles] = useState<NetworkProfileDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [remotePathPickerOpen, setRemotePathPickerOpen] = useState(false);

  const currentProfile = useMemo(
    () =>
      selectedProfileId
        ? (localProfiles.find((profile) => profile.id === selectedProfileId) ??
          networkProfiles.find((profile) => profile.id === selectedProfileId) ??
          (editingProfile?.id === selectedProfileId ? editingProfile : null))
        : null,
    [editingProfile, localProfiles, networkProfiles, selectedProfileId],
  );

  const profileList = useMemo(() => {
    const merged = [...localProfiles, ...networkProfiles];
    const uniqueProfiles = merged.filter(
      (profile, index, profiles) =>
        profiles.findIndex((item) => item.id === profile.id) === index,
    );
    if (
      editingProfile &&
      !uniqueProfiles.some((profile) => profile.id === editingProfile.id)
    ) {
      return [editingProfile, ...uniqueProfiles];
    }
    return uniqueProfiles;
  }, [editingProfile, localProfiles, networkProfiles]);

  const selectedProvider = providerFor(providers, scheme);
  const authKinds = defaultAuthKinds(scheme, providers);
  const showDefaultPath =
    scheme === "sftp" || scheme === "smb" || scheme === "webdav";
  const showBucketField = scheme === "s3";
  const showPasswordField = authKind === "password" || authKind === "accessKey";
  const showPrivateKeyField = authKind === "privateKey";
  const savedProfileSelected = currentProfile !== null;
  const unavailableMessage =
    selectedProvider?.status === "unavailable"
      ? (selectedProvider.missingDependency ??
        `${selectedProvider.label} is unavailable.`)
      : null;
  const tabs = useMemo<ConnectTab[]>(() => {
    const next: ConnectTab[] = ["general"];
    if (scheme === "sftp" || scheme === "ssh") next.push("ssh");
    if (scheme === "smb") next.push("smb");
    if (scheme === "s3") next.push("s3");
    next.push("test");
    return next;
  }, [scheme]);

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
  const canBrowseRemoteDefaultPath =
    Boolean(fs) &&
    currentProfile !== null &&
    showDefaultPath &&
    (scheme === "sftp" || scheme === "smb" || scheme === "webdav");
  const remoteDefaultPathRootUri =
    currentProfile && canBrowseRemoteDefaultPath
      ? rootUriForUri(currentProfile.defaultUri)
      : null;

  useEffect(() => {
    if (!open) {
      setLocalProfiles([]);
      return;
    }
    if (editingProfile) {
      loadProfile(editingProfile);
    } else {
      loadNewConnection(initialDraft);
    }
  }, [editingProfile, initialDraft, open]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab("general");
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (!open || !fs || (scheme !== "sftp" && scheme !== "ssh")) {
      return;
    }
    let cancelled = false;
    const homeLocation =
      locations.find((location) => location.id === "home") ??
      locations.find(
        (location) =>
          location.section === "Favorites" &&
          location.name.toLowerCase() === "home",
      );
    if (!homeLocation?.uri?.startsWith("local://")) {
      return;
    }
    const homeBase = homeLocation.uri.replace(/\/+$/, "");
    setDetectingSshKeys(true);
    void Promise.all(
      SSH_KEY_NAMES.map(async (name) => {
        const uri = `${homeBase}/.ssh/${name}`;
        try {
          const response = await fs.stat({ uri });
          return response.entry.kind === "file"
            ? displayPathFromUri(uri)
            : null;
        } catch {
          return null;
        }
      }),
    ).then((keys) => {
      if (cancelled) return;
      const detected = keys.filter((key): key is string => Boolean(key));
      setDetectedSshKeys(detected);
      setDetectingSshKeys(false);
      if (!privateKeyPath && detected[0]) {
        setPrivateKeyPath(detected[0]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fs, locations, open, privateKeyPath, scheme]);

  function resetVolatileState() {
    setPassword("");
    setPassphrase("");
    setTestState({ status: "idle" });
    setError(null);
    setInvalidFields(new Set());
    setRemotePathPickerOpen(false);
  }

  function applySchemeDefaults(nextScheme: SchemeType) {
    setScheme(nextScheme);
    setPort(String(defaultPort(nextScheme, providers)));
    setAuthKind(defaultAuthKind(nextScheme, providers));
    setDefaultPath("/");
  }

  function loadNewConnection(draft?: NetworkConnectionDraftDto | null) {
    const candidate = draft?.scheme ?? "sftp";
    const nextScheme = (
      ["sftp", "ssh", "smb", "s3", "webdav"].includes(candidate)
        ? candidate
        : "sftp"
    ) as SchemeType;
    setSelectedProfileId(null);
    setLabel(draft?.label ?? "");
    setScheme(nextScheme);
    setHost(draft?.host ?? "");
    setPort(String(defaultPort(nextScheme, providers)));
    setUsername("");
    setAuthKind(defaultAuthKind(nextScheme, providers));
    setPrivateKeyPath(preferences?.networkSshKeyPath ?? "");
    setDefaultPath(draft?.defaultPath ?? "/");
    setUseAgent(preferences?.networkUseSshAgent ?? false);
    setSshConfigHost("");
    setProxyJump("");
    setProxyCommand("");
    setKeepaliveSecs("");
    setCompression(false);
    setAddressFamily("auto");
    setTerminalInitialCommand("");
    setSmbWorkgroup("");
    setSmbMinProtocol("");
    setSmbSigningMode("default");
    setSmbSharePath("");
    setS3Region("");
    setS3UseTls(true);
    setS3PathStyle(false);
    setS3RootPrefix("");
    setActiveTab("general");
    resetVolatileState();
  }

  function loadProfile(profile: NetworkProfileDto) {
    const nextScheme = (
      ["sftp", "ssh", "smb", "s3", "webdav"].includes(profile.scheme)
        ? profile.scheme
        : "sftp"
    ) as SchemeType;
    const validAuthKinds = defaultAuthKinds(nextScheme, providers);
    const nextAuthKind = validAuthKinds.includes(
      profile.authKind as AuthKindType,
    )
      ? (profile.authKind as AuthKindType)
      : defaultAuthKind(nextScheme, providers);
    setSelectedProfileId(profile.id);
    setLabel(profile.label);
    setScheme(nextScheme);
    setHost(profile.host);
    setPort(String(profile.port));
    setUsername(profile.username);
    setAuthKind(nextAuthKind);
    setPrivateKeyPath(
      profile.privateKeyPath ?? preferences?.networkSshKeyPath ?? "",
    );
    setDefaultPath(profile.defaultPath || "/");
    setUseAgent(
      profile.options?.ssh?.useAgent ??
        preferences?.networkUseSshAgent ??
        false,
    );
    setSshConfigHost(profile.options?.ssh?.sshConfigHost ?? "");
    setProxyJump(profile.options?.ssh?.proxyJump ?? "");
    setProxyCommand(profile.options?.ssh?.proxyCommand ?? "");
    setKeepaliveSecs(
      profile.options?.ssh?.keepaliveSecs
        ? String(profile.options.ssh.keepaliveSecs)
        : "",
    );
    setCompression(profile.options?.ssh?.compression === true);
    setAddressFamily(profile.options?.ssh?.addressFamily ?? "auto");
    setTerminalInitialCommand(
      profile.options?.ssh?.terminalInitialCommand ?? "",
    );
    setSmbWorkgroup(profile.options?.smb?.workgroup ?? "");
    setSmbMinProtocol(profile.options?.smb?.minProtocol ?? "");
    setSmbSigningMode(profile.options?.smb?.signingMode ?? "default");
    setSmbSharePath(profile.options?.smb?.sharePath ?? "");
    setS3Region(profile.options?.s3?.region ?? "");
    setS3UseTls(profile.options?.s3?.useTls !== false);
    setS3PathStyle(profile.options?.s3?.pathStyle === true);
    setS3RootPrefix(profile.options?.s3?.rootPrefix ?? "");
    setActiveTab("general");
    resetVolatileState();
  }

  function updatePrivateKeyPath(nextPath: string) {
    setPrivateKeyPath(nextPath);
    clearInvalidField("privateKey");
  }

  async function browsePrivateKeyPath() {
    const selected = await pickLocalPath({
      kind: "file",
      currentPath: privateKeyPath,
      title: "Choose private key",
    });
    if (selected) {
      updatePrivateKeyPath(selected);
    }
  }

  function handleSchemeChange(nextScheme: SchemeType) {
    const provider = providerFor(providers, nextScheme);
    if (provider?.status === "unavailable") {
      return;
    }
    applySchemeDefaults(nextScheme);
    setTestState({ status: "idle" });
  }

  function buildProtocolOptions(): NetworkProtocolOptionsDto {
    const options: NetworkProtocolOptionsDto = {};
    if (scheme === "sftp" || scheme === "ssh") {
      options.ssh = {
        useAgent,
        sshConfigHost: sshConfigHost.trim() || null,
        proxyJump: proxyJump.trim() || null,
        proxyCommand: proxyCommand.trim() || null,
        keepaliveSecs:
          keepaliveSecs.trim() === "" ? null : Number(keepaliveSecs),
        compression,
        addressFamily,
        terminalInitialCommand: terminalInitialCommand.trim() || null,
      };
    }
    if (scheme === "smb") {
      options.smb = {
        workgroup: smbWorkgroup.trim() || null,
        minProtocol: smbMinProtocol.trim() || null,
        signingMode: smbSigningMode,
        sharePath: smbSharePath.trim() || null,
      };
    }
    if (scheme === "s3") {
      options.s3 = {
        region: s3Region.trim() || null,
        useTls: s3UseTls,
        pathStyle: s3PathStyle,
        rootPrefix: s3RootPrefix.trim() || null,
      };
    }
    return options;
  }

  function buildPayload() {
    return {
      id: currentProfile?.id,
      scheme,
      label: label.trim(),
      host: host.trim(),
      port: Number(port),
      username: username.trim(),
      authKind,
      privateKeyPath: authKind === "privateKey" ? privateKeyPath.trim() : null,
      defaultPath: defaultPath.trim() || "/",
      options: buildProtocolOptions(),
      password,
      passphrase,
    };
  }

  function invalidFieldsMessage(invalid: Set<string>): string | null {
    if (invalid.size === 0) return null;
    const missing: string[] = [];
    if (invalid.has("label")) missing.push("Profile name");
    if (invalid.has("host")) missing.push(hostLabel);
    if (invalid.has("port")) missing.push("Port (1-65535)");
    if (invalid.has("username")) missing.push(usernameLabel);
    if (invalid.has("privateKey")) missing.push("Private key path");
    if (invalid.has("password")) missing.push(passwordLabel);
    return `Missing or invalid: ${missing.join(", ")}.`;
  }

  function clearInvalidField(...fields: string[]) {
    const next = new Set(invalidFields);
    let changed = false;
    for (const field of fields) {
      if (next.delete(field)) changed = true;
    }
    if (!changed) return;
    setInvalidFields(next);
    setError(invalidFieldsMessage(next));
  }

  function validate(): boolean {
    const invalid = new Set<string>();
    const parsedPort = Number(port);
    if (!label.trim()) invalid.add("label");
    if (!host.trim()) invalid.add("host");
    if (!Number.isFinite(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      invalid.add("port");
    }
    if (!username.trim()) invalid.add("username");
    if (authKind === "privateKey" && !privateKeyPath.trim()) {
      invalid.add("privateKey");
    }
    if (showPasswordField && !currentProfile && !password) {
      invalid.add("password");
    }
    if (unavailableMessage) {
      setError(unavailableMessage);
      return false;
    }
    if (invalid.size > 0) {
      setInvalidFields(invalid);
      setError(invalidFieldsMessage(invalid));
      return false;
    }
    setInvalidFields(new Set());
    setError(null);
    return true;
  }

  async function runTest() {
    if (!validate()) {
      setActiveTab("general");
      return;
    }
    if (currentProfile?.id && onTest) {
      setTestState({ status: "testing" });
      setActiveTab("test");
      try {
        const result = await onTest(currentProfile.id);
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
      return;
    }
    if (!onTestDraft) return;
    setTestState({ status: "testing" });
    setActiveTab("test");
    try {
      const result = await onTestDraft(buildPayload());
      setTestState({
        status: result.ok ? "success" : "error",
        message: result.message,
        durationMs: result.durationMs,
        resolvedUri: result.resolvedUri,
        fingerprint: result.observedFingerprint,
        trustState: result.trustState,
        warnings: result.warnings,
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

  async function handleSubmit() {
    if (!validate()) {
      setActiveTab("general");
      return;
    }
    setSaving(true);
    try {
      const profile = await onSave(buildPayload());
      setLocalProfiles((current) => [
        profile,
        ...current.filter((item) => item.id !== profile.id),
      ]);
      loadProfile(profile);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save connection.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleConnect() {
    if (currentProfile) {
      onConnectProfile?.(currentProfile);
    }
  }

  function tabLabel(tab: ConnectTab): string {
    if (tab === "general") return "General";
    if (tab === "ssh") return "SSH";
    if (tab === "smb") return "SMB";
    if (tab === "s3") return "S3";
    return "Test & Trust";
  }

  const footer = (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={testState.status === "testing" || Boolean(unavailableMessage)}
        onClick={() => void runTest()}
      >
        {testState.status === "testing" ? "Testing..." : "Test"}
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={!savedProfileSelected}
        title={
          savedProfileSelected ? undefined : "Save the connection profile first"
        }
        onClick={handleConnect}
      >
        Connect
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={saving || Boolean(unavailableMessage)}
        onClick={() => void handleSubmit()}
      >
        {saving ? "Saving..." : "Save"}
      </Button>
    </>
  );

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Connections"
      subtitle="Manage remote connection profiles. Credentials stay in the OS keychain."
      className="fo-connect-manager-dialog"
      size="lg"
      footer={footer}
    >
      <div className="fo-connect-manager">
        <aside className="fo-connect-manager-sidebar" aria-label="Connections">
          <button
            type="button"
            aria-label="New Connection"
            className={cx(
              "fo-connect-profile-row",
              selectedProfileId === null && "fo-connect-profile-row-active",
            )}
            onClick={() => loadNewConnection(initialDraft)}
          >
            <span className="fo-connect-profile-icon">{Icons.plus()}</span>
            <span>
              <strong>New Connection</strong>
              <small>{protocolLabel(scheme)}</small>
            </span>
          </button>
          <div className="fo-connect-profile-list">
            {profileList.map((profile) => {
              const provider = providerFor(
                providers,
                profile.scheme as SchemeType,
              );
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={cx(
                    "fo-connect-profile-row",
                    selectedProfileId === profile.id &&
                      "fo-connect-profile-row-active",
                  )}
                  onClick={() => loadProfile(profile)}
                >
                  <span className="fo-connect-profile-icon">
                    {profile.scheme === "ssh"
                      ? Icons.terminal()
                      : Icons.server()}
                  </span>
                  <span>
                    <strong>{profile.label}</strong>
                    <small>
                      {protocolLabel(profile.scheme)} · {providerMode(provider)}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="fo-connect-manager-editor">
          <header className="fo-connect-editor-header">
            <span className="fo-connect-editor-icon" aria-hidden="true">
              {scheme === "ssh" ? Icons.terminal() : Icons.server()}
            </span>
            <div>
              <h3>{label.trim() || "New Connection"}</h3>
              <p>
                {protocolLabel(scheme)} · {providerMode(selectedProvider)}
                {currentProfile ? " · saved profile" : " · unsaved draft"}
              </p>
            </div>
          </header>

          <div
            className="fo-connect-tabs"
            role="tablist"
            aria-label="Connection settings"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={cx(
                  "fo-connect-tab",
                  activeTab === tab && "fo-connect-tab-active",
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          <div className="fo-connect-tab-panel">
            {error ? (
              <div className="fo-dialog-error" role="alert">
                {error}
              </div>
            ) : null}
            {unavailableMessage ? (
              <div className="fo-connect-provider-warning">
                {unavailableMessage}
              </div>
            ) : null}
            {activeTab === "general" ? (
              <div className="fo-connect-grid">
                <label className="fo-dialog-field">
                  <span>Profile name</span>
                  <input
                    value={label}
                    aria-invalid={invalidFields.has("label") || undefined}
                    className={
                      invalidFields.has("label")
                        ? "fo-field-invalid"
                        : undefined
                    }
                    onChange={(event) => {
                      setLabel(event.target.value);
                      clearInvalidField("label");
                    }}
                    placeholder="Production SFTP"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>Protocol</span>
                  <select
                    value={scheme}
                    disabled={currentProfile !== null}
                    onChange={(event) =>
                      handleSchemeChange(event.target.value as SchemeType)
                    }
                  >
                    {providers.map((provider) => (
                      <option
                        key={provider.scheme}
                        value={provider.scheme}
                        disabled={provider.status === "unavailable"}
                      >
                        {provider.label}
                        {provider.status === "unavailable"
                          ? " - unavailable"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fo-dialog-field">
                  <span>{hostLabel}</span>
                  <input
                    aria-label={hostLabel}
                    value={host}
                    aria-invalid={invalidFields.has("host") || undefined}
                    className={
                      invalidFields.has("host") ? "fo-field-invalid" : undefined
                    }
                    onChange={(event) => {
                      setHost(event.target.value);
                      clearInvalidField("host");
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
                      clearInvalidField("port");
                    }}
                    inputMode="numeric"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>{usernameLabel}</span>
                  <input
                    aria-label={usernameLabel}
                    value={username}
                    aria-invalid={invalidFields.has("username") || undefined}
                    className={
                      invalidFields.has("username")
                        ? "fo-field-invalid"
                        : undefined
                    }
                    onChange={(event) => {
                      setUsername(event.target.value);
                      clearInvalidField("username");
                    }}
                    placeholder={usernamePlaceholder}
                  />
                </label>
                {authKinds.length > 1 ? (
                  <div className="fo-dialog-field fo-connect-full">
                    <span>Authentication</span>
                    <div
                      className="fo-connect-auth-options"
                      role="group"
                      aria-label="Authentication method"
                    >
                      {authKinds.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={authKind === kind}
                          className={
                            authKind === kind
                              ? "fo-connect-auth-option fo-connect-auth-option-active"
                              : "fo-connect-auth-option"
                          }
                          onClick={() => {
                            setAuthKind(kind);
                            clearInvalidField("password", "privateKey");
                          }}
                        >
                          {kind === "privateKey"
                            ? "Private key"
                            : kind === "accessKey"
                              ? "Access key"
                              : "Password"}
                        </button>
                      ))}
                    </div>
                  </div>
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
                        clearInvalidField("password");
                      }}
                      placeholder={
                        currentProfile?.hasStoredSecret
                          ? "Leave blank to keep existing"
                          : ""
                      }
                    />
                  </label>
                ) : null}
                {showPrivateKeyField ? (
                  <>
                    <div className="fo-dialog-field fo-connect-full">
                      <span>Detected keys</span>
                      <div className="fo-connect-key-list">
                        {detectingSshKeys ? (
                          <span className="fo-settings-hint">
                            Scanning Home/.ssh...
                          </span>
                        ) : detectedSshKeys.length > 0 ? (
                          detectedSshKeys.map((keyPath) => (
                            <button
                              key={keyPath}
                              type="button"
                              className={
                                privateKeyPath === keyPath
                                  ? "fo-connect-key-option fo-connect-key-option-active"
                                  : "fo-connect-key-option"
                              }
                              onClick={() => updatePrivateKeyPath(keyPath)}
                            >
                              {keyPath}
                            </button>
                          ))
                        ) : (
                          <span className="fo-settings-hint">
                            No common SSH keys found in Home/.ssh.
                          </span>
                        )}
                      </div>
                    </div>
                    <PathBrowseField
                      className="fo-dialog-field fo-connect-full"
                      label="Private key path"
                      value={privateKeyPath}
                      placeholder="~/.ssh/id_ed25519"
                      browseLabel="Browse private key path"
                      onChange={updatePrivateKeyPath}
                      onBrowse={() => void browsePrivateKeyPath()}
                    />
                    <label className="fo-dialog-field">
                      <span>Key passphrase</span>
                      <input
                        type="password"
                        value={passphrase}
                        onChange={(event) => setPassphrase(event.target.value)}
                        placeholder={
                          currentProfile ? "Leave blank to keep existing" : ""
                        }
                      />
                    </label>
                  </>
                ) : null}
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
                    </label>
                  )
                ) : null}
              </div>
            ) : null}

            {activeTab === "ssh" ? (
              <div className="fo-connect-grid">
                <label className="fo-dialog-checkbox fo-connect-full">
                  <input
                    type="checkbox"
                    aria-label="Use SSH agent"
                    checked={useAgent}
                    onChange={(event) => setUseAgent(event.target.checked)}
                  />
                  <span>Use SSH agent</span>
                </label>
                <label className="fo-dialog-field">
                  <span>SSH config host</span>
                  <input
                    value={sshConfigHost}
                    onChange={(event) => setSshConfigHost(event.target.value)}
                    placeholder="prod-bastion"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>ProxyJump</span>
                  <input
                    value={proxyJump}
                    onChange={(event) => setProxyJump(event.target.value)}
                    placeholder="bastion.example.com"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>ProxyCommand</span>
                  <input
                    value={proxyCommand}
                    onChange={(event) => setProxyCommand(event.target.value)}
                    placeholder="ssh -W %h:%p jumpbox"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>Keepalive seconds</span>
                  <input
                    value={keepaliveSecs}
                    onChange={(event) => setKeepaliveSecs(event.target.value)}
                    inputMode="numeric"
                    placeholder="30"
                  />
                </label>
                <label className="fo-dialog-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Enable SSH compression"
                    checked={compression}
                    onChange={(event) => setCompression(event.target.checked)}
                  />
                  <span>Enable SSH compression</span>
                </label>
                <label className="fo-dialog-field">
                  <span>Address family</span>
                  <select
                    value={addressFamily}
                    onChange={(event) => setAddressFamily(event.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="ipv4">IPv4 only</option>
                    <option value="ipv6">IPv6 only</option>
                  </select>
                </label>
                <label className="fo-dialog-field fo-connect-full">
                  <span>Terminal initial command</span>
                  <input
                    value={terminalInitialCommand}
                    onChange={(event) =>
                      setTerminalInitialCommand(event.target.value)
                    }
                    placeholder="cd /srv/app"
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "smb" ? (
              <div className="fo-connect-grid">
                <label className="fo-dialog-field">
                  <span>Workgroup / domain</span>
                  <input
                    value={smbWorkgroup}
                    onChange={(event) => setSmbWorkgroup(event.target.value)}
                    placeholder="WORKGROUP"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>Minimum protocol</span>
                  <input
                    value={smbMinProtocol}
                    onChange={(event) => setSmbMinProtocol(event.target.value)}
                    placeholder="SMB3"
                  />
                </label>
                <label className="fo-dialog-field">
                  <span>Signing mode</span>
                  <select
                    value={smbSigningMode}
                    onChange={(event) => setSmbSigningMode(event.target.value)}
                  >
                    <option value="default">Default</option>
                    <option value="required">Required</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="fo-dialog-field">
                  <span>Share path override</span>
                  <input
                    value={smbSharePath}
                    onChange={(event) => setSmbSharePath(event.target.value)}
                    placeholder="/share"
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "s3" ? (
              <div className="fo-connect-grid">
                <label className="fo-dialog-field">
                  <span>Region</span>
                  <input
                    value={s3Region}
                    onChange={(event) => setS3Region(event.target.value)}
                    placeholder="us-east-1"
                  />
                </label>
                <label className="fo-dialog-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Use TLS"
                    checked={s3UseTls}
                    onChange={(event) => setS3UseTls(event.target.checked)}
                  />
                  <span>Use TLS</span>
                </label>
                <label className="fo-dialog-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Use path-style URLs"
                    checked={s3PathStyle}
                    onChange={(event) => setS3PathStyle(event.target.checked)}
                  />
                  <span>Use path-style URLs</span>
                </label>
                <label className="fo-dialog-field">
                  <span>Root prefix</span>
                  <input
                    value={s3RootPrefix}
                    onChange={(event) => setS3RootPrefix(event.target.value)}
                    placeholder="team/files"
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "test" ? (
              <div className="fo-connect-test-panel">
                <dl className="fo-detail-grid fo-connect-summary">
                  <dt>Profile</dt>
                  <dd>{label || "-"}</dd>
                  <dt>Protocol</dt>
                  <dd>{protocolLabel(scheme)}</dd>
                  <dt>{hostLabel}</dt>
                  <dd>{host ? `${host}:${port}` : "—"}</dd>
                  <dt>{usernameLabel}</dt>
                  <dd>{username || "-"}</dd>
                  <dt>{defaultPathLabel}</dt>
                  <dd>{defaultPath || "/"}</dd>
                </dl>
                {currentProfile?.hostKeyFingerprint ? (
                  <div className="fo-dialog-field fo-dialog-field-static">
                    <span>Pinned host key</span>
                    <code
                      className="fo-fingerprint-display"
                      title={currentProfile.hostKeyFingerprint}
                    >
                      {currentProfile.hostKeyFingerprint}
                    </code>
                    {onForgetFingerprint ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void onForgetFingerprint(currentProfile.id);
                        }}
                      >
                        Forget pinned fingerprint
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {testState.status === "idle" ? (
                  <p className="fo-settings-hint">
                    Run Test to validate the current profile details.
                  </p>
                ) : testState.status === "testing" ? (
                  <p className="fo-settings-hint">Testing connection...</p>
                ) : (
                  <div
                    className={
                      testState.status === "success"
                        ? "fo-connect-test-card fo-connect-test-card--ok"
                        : "fo-connect-test-card fo-connect-test-card--error"
                    }
                    role={testState.status === "success" ? "status" : "alert"}
                  >
                    <p>{testState.message}</p>
                    {testState.durationMs != null ? (
                      <p>Duration: {testState.durationMs} ms</p>
                    ) : null}
                    {testState.resolvedUri ? (
                      <p>Resolved URI: {testState.resolvedUri}</p>
                    ) : null}
                    {testState.trustState ? (
                      <p>Trust: {testState.trustState}</p>
                    ) : null}
                    {testState.fingerprint ? (
                      <code className="fo-fingerprint-display">
                        {testState.fingerprint}
                      </code>
                    ) : null}
                    {testState.warnings?.length ? (
                      <ul>
                        {testState.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
      <DialogShell
        open={remotePathPickerOpen && remoteDefaultPathRootUri !== null}
        onClose={() => setRemotePathPickerOpen(false)}
        title="Choose Default Path"
        subtitle={currentProfile?.label}
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
    </DialogShell>
  );
}
