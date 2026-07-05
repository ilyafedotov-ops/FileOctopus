import {
  PropertiesSection,
  PropertiesRow,
  formatContains,
  formatFlags,
} from "./propertiesDialogParts";
import { useState, useEffect, useRef } from "react";
import type {
  FileEntryDto,
  FsClient,
  PathPropertiesDto,
} from "@fileoctopus/ts-api";
import { Badge, Button, fileEntryIcon } from "@fileoctopus/ui";
import type { PanelId } from "../../panelStore";
import { propertyType, localPathFromUri } from "../../utils/paneUtils";
import { formatDate, formatSize } from "../../pane/fileTableUtils";
import { isImagePreviewable } from "../PreviewPanel";
import { AclEditor } from "./AclEditor";

function exifRows(properties: PathPropertiesDto) {
  const exif = properties.exif;
  if (!exif) {
    return [];
  }
  const camera = [exif.cameraMake, exif.cameraModel].filter(Boolean).join(" ");
  const dimensions =
    exif.width != null && exif.height != null
      ? `${exif.width} × ${exif.height}`
      : null;
  const gps =
    exif.gpsLatitude != null && exif.gpsLongitude != null
      ? `${exif.gpsLatitude.toFixed(6)}, ${exif.gpsLongitude.toFixed(6)}`
      : null;
  return [
    ["Camera", camera],
    ["Lens", exif.lensModel],
    ["Date taken", exif.dateTaken ? formatDate(exif.dateTaken) : null],
    ["Dimensions", dimensions],
    ["Orientation", exif.orientation],
    ["Exposure", exif.exposureTime],
    ["Aperture", exif.fNumber],
    ["ISO", exif.iso != null ? String(exif.iso) : null],
    ["Focal length", exif.focalLength],
    ["GPS", gps],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

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
  focusPermissions?: boolean;
  onCopyPath: () => void;
  onReveal: () => void;
}

export function PropertiesDialog({
  open,
  state,
  fs,
  focusPermissions = false,
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
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const permissionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusPermissions && properties) {
      permissionsRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [focusPermissions, properties?.uri]);

  useEffect(() => {
    const entry = state.entry;
    if (!fs || !entry || !isImagePreviewable(entry)) {
      setThumbUri(null);
      return;
    }
    let cancelled = false;
    setThumbUri(null);
    fs.readFileAsDataUri({ uri: entry.uri, maxBytes: 4 * 1024 * 1024 })
      .then((response) => {
        if (!cancelled) setThumbUri(response.dataUri);
      })
      .catch(() => {
        if (!cancelled) setThumbUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fs, state.entry?.uri]);

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
            {thumbUri ? (
              <img
                className="fo-properties-thumb"
                src={thumbUri}
                alt={properties.name}
              />
            ) : (
              <span className="fo-properties-icon" aria-hidden="true">
                {entryForIcon ? fileEntryIcon(entryForIcon) : null}
              </span>
            )}
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

          <PropertiesSection title="Dates" collapsible>
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

          <PropertiesSection title="Attributes" collapsible>
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

          {properties.exif ? (
            <>
              <PropertiesSection title="EXIF" collapsible>
                <dl className="fo-properties-grid">
                  {exifRows(properties).map(([label, value]) => (
                    <PropertiesRow key={label} label={label} value={value} />
                  ))}
                </dl>
              </PropertiesSection>
              {properties.exif.tags.length > 0 ? (
                <PropertiesSection
                  title="Raw EXIF"
                  collapsible
                  defaultOpen={false}
                >
                  <dl className="fo-properties-grid">
                    {properties.exif.tags.slice(0, 12).map((tag) => (
                      <PropertiesRow
                        key={`${tag.group}:${tag.tag}:${tag.label}`}
                        label={tag.label}
                        value={tag.value}
                      />
                    ))}
                  </dl>
                </PropertiesSection>
              ) : null}
            </>
          ) : null}

          {properties.kind !== "directory" ? (
            <PropertiesSection title="Checksum" collapsible>
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
                      <span className="fo-properties-hash">
                        <span
                          className="fo-properties-value fo-properties-value--mono"
                          title={hash}
                        >
                          {hash}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Copy SHA-256"
                          onClick={() =>
                            void navigator.clipboard.writeText(hash)
                          }
                        >
                          Copy
                        </Button>
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
                        value={<Badge tone="success">Match ✓</Badge>}
                      />
                    ) : verified === "mismatch" ? (
                      <PropertiesRow
                        label="Verification"
                        value={<Badge tone="danger">Mismatch ✗</Badge>}
                      />
                    ) : null}
                  </>
                ) : null}
              </dl>
            </PropertiesSection>
          ) : null}

          <div ref={permissionsRef}>
            <PropertiesSection title="Permissions" collapsible defaultOpen>
              <AclEditor
                uri={properties.uri}
                fs={fs}
                isDirectory={properties.kind === "directory"}
              />
            </PropertiesSection>
          </div>

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
