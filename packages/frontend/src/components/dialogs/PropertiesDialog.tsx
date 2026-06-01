import {
  PropertiesSection,
  PropertiesRow,
  formatContains,
  formatFlags,
} from "./propertiesDialogParts";
import { useState, useEffect } from "react";
import type {
  FileEntryDto,
  FsClient,
  PathPropertiesDto,
} from "@fileoctopus/ts-api";
import { Button, fileEntryIcon } from "@fileoctopus/ui";
import type { PanelId } from "../../panelStore";
import { propertyType, localPathFromUri } from "../../utils/paneUtils";
import { formatDate, formatSize } from "../../pane/fileTableUtils";
import { AclEditor } from "./AclEditor";

export interface PropertiesDialogState {
  panelId: PanelId;
  entry: FileEntryDto | null;
  properties: PathPropertiesDto | null;
  loading: boolean;
  error: string | null;
}

interface PropertiesDialogProps {
  open: boolean;
  state: PropertiesDialogState;
  fs?: FsClient;
  onCopyPath: () => void;
  onReveal: () => void;
}

export function PropertiesDialog({
  open,
  state,
  fs,
  onCopyPath,
  onReveal,
}: PropertiesDialogProps) {
  if (!open) {
    return null;
  }

  const { properties, loading, error } = state;
  const entryForIcon =
    state.entry ??
    (properties
      ? { kind: properties.kind, name: properties.name, extension: null }
      : null);

  const sizeValue = properties
    ? formatSize(properties.size ?? properties.totalSize)
    : null;
  const sizeLabel =
    loading && properties?.kind === "directory" ? (
      <span className="fo-properties-calculating">Calculating size…</span>
    ) : (
      sizeValue
    );

  const [hash, setHash] = useState<string | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [verified, setVerified] = useState<"match" | "mismatch" | null>(null);

  useEffect(() => {
    if (!fs || !state.entry || state.entry.kind === "directory") {
      setHash(null);
      setHashLoading(false);
      setHashError(null);
      setExpectedHash("");
      setVerified(null);
      return;
    }

    setHashLoading(true);
    setHashError(null);
    setHash(null);
    setExpectedHash("");
    setVerified(null);

    fs.computeHash({ uri: state.entry.uri, algorithm: "sha256" })
      .then((res) => {
        setHash(res.hash);
        setHashLoading(false);
      })
      .catch(() => {
        setHashError("Failed to compute hash");
        setHashLoading(false);
      });
  }, [fs, state.entry?.uri]);

  return (
    <div className="fo-properties">
      {loading && !properties ? (
        <div className="fo-properties-state" role="status">
          Loading properties…
        </div>
      ) : null}
      {error ? <div className="fo-operation-error">{error}</div> : null}
      {properties ? (
        <>
          <div className="fo-properties-hero">
            <span className="fo-properties-icon" aria-hidden="true">
              {entryForIcon ? fileEntryIcon(entryForIcon) : null}
            </span>
            <div className="fo-properties-heading">
              <strong title={properties.name}>{properties.name}</strong>
              <span>{propertyType(properties)}</span>
            </div>
            <span className="fo-properties-size">{sizeLabel}</span>
          </div>

          <PropertiesSection title="General">
            <dl className="fo-properties-grid">
              <PropertiesRow label="Name" value={properties.name} />
              <PropertiesRow label="Type" value={propertyType(properties)} />
              {state.entry?.extension ? (
                <PropertiesRow
                  label="Extension"
                  value={state.entry.extension}
                />
              ) : null}
              <PropertiesRow label="Size" value={sizeLabel} />
              {properties.kind === "directory" ? (
                <PropertiesRow
                  label="Contains"
                  value={formatContains(properties)}
                />
              ) : null}
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Location">
            <dl className="fo-properties-grid">
              <PropertiesRow
                label="Full path"
                value={
                  <span className="fo-properties-value fo-properties-value--mono">
                    {localPathFromUri(properties.uri)}
                  </span>
                }
              />
              <PropertiesRow
                label="Resource URI"
                value={
                  <span className="fo-properties-value fo-properties-value--mono">
                    {properties.uri}
                  </span>
                }
              />
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Dates">
            <dl className="fo-properties-grid">
              <PropertiesRow
                label="Created"
                value={formatDate(properties.createdAt)}
              />
              <PropertiesRow
                label="Modified"
                value={formatDate(properties.modifiedAt)}
              />
              <PropertiesRow
                label="Accessed"
                value={formatDate(properties.accessedAt)}
              />
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Attributes">
            <dl className="fo-properties-grid">
              <PropertiesRow label="Flags" value={formatFlags(properties)} />
              {state.entry?.permissions ? (
                <PropertiesRow
                  label="Permissions"
                  value={state.entry.permissions}
                />
              ) : null}
              {state.entry?.owner ? (
                <PropertiesRow label="Owner" value={state.entry.owner} />
              ) : null}
              {state.entry?.providerId ? (
                <PropertiesRow
                  label="Provider"
                  value={state.entry.providerId}
                />
              ) : null}
              {state.entry?.protocol ? (
                <PropertiesRow label="Protocol" value={state.entry.protocol} />
              ) : null}
            </dl>
          </PropertiesSection>

          {properties.kind !== "directory" ? (
            <PropertiesSection title="Checksum">
              <dl className="fo-properties-grid">
                <PropertiesRow
                  label="SHA-256"
                  value={
                    hashLoading ? (
                      <span className="fo-properties-calculating">
                        Computing…
                      </span>
                    ) : hashError ? (
                      <span className="fo-properties-error">{hashError}</span>
                    ) : hash ? (
                      <span
                        className="fo-properties-value fo-properties-value--mono"
                        title={hash}
                      >
                        {hash}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                {hash && !hashLoading && !hashError ? (
                  <>
                    <PropertiesRow
                      label="Expected hash"
                      value={
                        <input
                          type="text"
                          className="fo-properties-input"
                          placeholder="Paste expected SHA-256…"
                          value={expectedHash}
                          onChange={(e) => {
                            const value = e.target.value;
                            setExpectedHash(value);
                            const trimmed = value.trim().toLowerCase();
                            if (trimmed) {
                              setVerified(
                                trimmed === hash.toLowerCase()
                                  ? "match"
                                  : "mismatch",
                              );
                            } else {
                              setVerified(null);
                            }
                          }}
                        />
                      }
                    />
                    {verified === "match" ? (
                      <PropertiesRow
                        label="Verification"
                        value={
                          <span className="fo-properties-badge fo-properties-badge--success">
                            Match ✓
                          </span>
                        }
                      />
                    ) : verified === "mismatch" ? (
                      <PropertiesRow
                        label="Verification"
                        value={
                          <span className="fo-properties-badge fo-properties-badge--error">
                            Mismatch ✗
                          </span>
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </dl>
            </PropertiesSection>
          ) : null}

          <PropertiesSection title="Permissions">
            <AclEditor
              uri={properties.uri}
              fs={fs}
              isDirectory={properties.kind === "directory"}
            />
          </PropertiesSection>

          {properties.warnings.length > 0 ? (
            <div className="fo-properties-warnings" role="note">
              {properties.warnings.slice(0, 3).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="fo-properties-actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onCopyPath}
            >
              Copy Path
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(properties.uri)}
            >
              Copy URI
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReveal}>
              Reveal
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
