import { useEffect, useState } from "react";
import { Button } from "@fileoctopus/ui";
import type {
  FileOperationConflictDto,
  FileEntryDto,
  FsClient,
} from "@fileoctopus/ts-api";
import { displayPathFromUri } from "@fileoctopus/ts-api";

type ConflictAction = "overwrite" | "skip" | "renameNew";

interface ConflictResolutionResult {
  action: ConflictAction;
  applyToAll: boolean;
}

export interface ConflictEntryMetadata {
  size: number | null;
  modifiedAt: string | null;
}

interface ConflictResolutionDialogProps {
  conflicts: FileOperationConflictDto[];
  entries: FileEntryDto[];
  fs?: FsClient;
  destinationByUri?: Record<string, ConflictEntryMetadata>;
  onBack: () => void;
  onResolve: (result: ConflictResolutionResult) => void;
}

function fileNameFromUri(uri: string): string {
  const path = displayPathFromUri(uri);
  const parts = path.split("/");
  return parts[parts.length - 1] || uri;
}

function parentPathFromUri(uri: string): string {
  const path = displayPathFromUri(uri);
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.substring(0, idx) : "/";
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function entryMetadata(
  entry: FileEntryDto | undefined,
): ConflictEntryMetadata | undefined {
  if (!entry) {
    return undefined;
  }
  return {
    size: entry.size ?? null,
    modifiedAt: entry.modifiedAt ?? null,
  };
}

function findEntryForUri(
  entries: FileEntryDto[],
  uri: string,
): FileEntryDto | undefined {
  return entries.find((e) => e.uri === uri);
}

function useDestinationMetadata(
  conflicts: FileOperationConflictDto[],
  provided: Record<string, ConflictEntryMetadata> | undefined,
  fs: FsClient | undefined,
): Record<string, ConflictEntryMetadata> {
  const [loaded, setLoaded] = useState<Record<string, ConflictEntryMetadata>>(
    {},
  );

  useEffect(() => {
    if (provided && Object.keys(provided).length > 0) {
      setLoaded(provided);
      return;
    }

    if (!fs) {
      return;
    }

    let cancelled = false;
    const uris = [...new Set(conflicts.map((c) => c.destination))];

    void (async () => {
      const next: Record<string, ConflictEntryMetadata> = {};
      await Promise.all(
        uris.map(async (uri) => {
          try {
            const response = await fs.stat({ uri });
            next[uri] = {
              size: response.entry.size ?? null,
              modifiedAt: response.entry.modifiedAt ?? null,
            };
          } catch {
            next[uri] = { size: null, modifiedAt: null };
          }
        }),
      );
      if (!cancelled) {
        setLoaded(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fs, conflicts, provided]);

  if (provided && Object.keys(provided).length > 0) {
    return provided;
  }

  return loaded;
}

export function ConflictResolutionDialog({
  conflicts,
  entries,
  fs,
  destinationByUri,
  onBack,
  onResolve,
}: ConflictResolutionDialogProps) {
  const [selectedAction, setSelectedAction] = useState<ConflictAction>("skip");
  const [applyToAll, setApplyToAll] = useState(false);
  const destinationMetadata = useDestinationMetadata(
    conflicts,
    destinationByUri,
    fs,
  );

  function handleAction(action: ConflictAction) {
    onResolve({ action, applyToAll });
  }

  return (
    <section className="fo-dialog-section">
      <h3>Resolve Conflicts</h3>
      <p>
        {conflicts.length} item{conflicts.length !== 1 ? "s" : ""} already exist
        at the destination.
      </p>

      <div className="fo-conflict-list">
        {conflicts.map((conflict, i) => {
          const srcEntry = findEntryForUri(entries, conflict.source);
          const srcMeta = entryMetadata(srcEntry);
          const destMeta = destinationMetadata[conflict.destination];
          return (
            <div key={i} className="fo-conflict-item">
              <div className="fo-conflict-compare">
                <div className="fo-conflict-side fo-conflict-source">
                  <div className="fo-conflict-label">Source</div>
                  <div className="fo-conflict-name">
                    {fileNameFromUri(conflict.source)}
                  </div>
                  <div className="fo-conflict-path">
                    {parentPathFromUri(conflict.source)}
                  </div>
                  <div className="fo-conflict-meta">
                    <span>{formatSize(srcMeta?.size ?? null)}</span>
                    <span>{formatDate(srcMeta?.modifiedAt ?? null)}</span>
                  </div>
                </div>
                <div className="fo-conflict-arrow">→</div>
                <div className="fo-conflict-side fo-conflict-dest">
                  <div className="fo-conflict-label">Destination</div>
                  <div className="fo-conflict-name">
                    {fileNameFromUri(conflict.destination)}
                  </div>
                  <div className="fo-conflict-path">
                    {parentPathFromUri(conflict.destination)}
                  </div>
                  <div className="fo-conflict-meta">
                    <span>{formatSize(destMeta?.size ?? null)}</span>
                    <span>{formatDate(destMeta?.modifiedAt ?? null)}</span>
                  </div>
                </div>
              </div>
              {!applyToAll ? (
                <div className="fo-conflict-actions-per-item">
                  <label className="fo-conflict-radio">
                    <input
                      type="radio"
                      name={`conflict-${i}`}
                      value="skip"
                      checked={selectedAction === "skip"}
                      onChange={() => setSelectedAction("skip")}
                    />
                    Skip
                  </label>
                  <label className="fo-conflict-radio">
                    <input
                      type="radio"
                      name={`conflict-${i}`}
                      value="overwrite"
                      checked={selectedAction === "overwrite"}
                      onChange={() => setSelectedAction("overwrite")}
                    />
                    Replace
                  </label>
                  <label className="fo-conflict-radio">
                    <input
                      type="radio"
                      name={`conflict-${i}`}
                      value="renameNew"
                      checked={selectedAction === "renameNew"}
                      onChange={() => setSelectedAction("renameNew")}
                    />
                    Keep Both
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <label className="fo-checkbox-label fo-conflict-apply-all">
        <input
          type="checkbox"
          role="checkbox"
          aria-label="Apply to all conflicts"
          checked={applyToAll}
          onChange={(e) => setApplyToAll(e.target.checked)}
        />
        Apply to all conflicts
      </label>

      <div className="fo-dialog-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onBack()}
        >
          Cancel Operation
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleAction("skip")}
        >
          Skip
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleAction("renameNew")}
        >
          Keep Both
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => handleAction("overwrite")}
        >
          Replace
        </Button>
      </div>
    </section>
  );
}
