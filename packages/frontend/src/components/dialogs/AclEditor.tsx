import { useState, useEffect, useCallback } from "react";
import {
  uriScheme,
  type AclEntry,
  type GetAclResponse,
  type FsClient,
  type IpcError,
} from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";

interface AclEditorProps {
  uri: string;
  fs?: FsClient;
  isDirectory: boolean;
}

function octalFromEntries(entries: AclEntry[]): string {
  const digits = ["owner", "group", "other"].map((principal) => {
    const entry = entries.find((e) => e.principal === principal);
    if (!entry) return "0";
    const digit =
      (entry.read ? 4 : 0) + (entry.write ? 2 : 0) + (entry.execute ? 1 : 0);
    return digit.toString();
  });
  return digits.join("");
}

function entriesFromOctal(octal: string): AclEntry[] {
  const principals = ["owner", "group", "other"] as const;
  return principals.map((principal, i) => {
    const digit = parseInt(octal[i] ?? "0", 10);
    return {
      principal,
      read: (digit & 4) !== 0,
      write: (digit & 2) !== 0,
      execute: (digit & 1) !== 0,
    };
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (isIpcError(error)) return error.message;
  return fallback;
}

function isIpcError(error: unknown): error is IpcError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<IpcError>;
  return typeof candidate.message === "string";
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="fo-acl-checkbox" title={label}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

export function AclEditor({ uri, fs, isDirectory }: AclEditorProps) {
  const [acl, setAcl] = useState<GetAclResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AclEntry[]>([]);
  const [octalInput, setOctalInput] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const scheme = uriScheme(uri);

  useEffect(() => {
    if (!fs) {
      setLoading(false);
      setError("Permissions management is unavailable.");
      return;
    }

    if (scheme !== "local") {
      setLoading(false);
      setError("Permissions management is only available for local files.");
      return;
    }

    setLoading(true);
    setError(null);
    fs.getAcl({ uri })
      .then((res) => {
        setAcl(res);
        setEntries(res.entries);
        setOctalInput(res.octal);
        setDirty(false);
      })
      .catch((err: unknown) => {
        setError(errorMessage(err, "Failed to load ACL"));
      })
      .finally(() => setLoading(false));
  }, [fs, uri, scheme]);

  const togglePermission = useCallback(
    (principal: string, perm: "read" | "write" | "execute", value: boolean) => {
      setEntries((prev) => {
        const updated = prev.map((e) =>
          e.principal === principal ? { ...e, [perm]: value } : e,
        );
        setOctalInput(octalFromEntries(updated));
        setDirty(true);
        return updated;
      });
    },
    [],
  );

  const handleOctalChange = useCallback((value: string) => {
    const clean = value.replace(/[^0-7]/g, "").slice(0, 3);
    setOctalInput(clean);
    if (clean.length === 3) {
      setEntries(entriesFromOctal(clean));
      setDirty(true);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!fs || octalInput.length !== 3) return;
    setSaving(true);
    setSaveError(null);
    fs.setAcl({ uri, octal: octalInput, recursive })
      .then(() => setDirty(false))
      .catch((err: unknown) => {
        setSaveError(errorMessage(err, "Failed to set permissions"));
      })
      .finally(() => setSaving(false));
  }, [fs, uri, octalInput, recursive]);

  if (loading) {
    return (
      <div className="fo-properties-state" role="status">
        Loading permissions…
      </div>
    );
  }

  if (error) {
    return <div className="fo-operation-error">{error}</div>;
  }

  return (
    <div className="fo-acl-editor">
      <div className="fo-acl-info">
        {acl?.owner ? (
          <span className="fo-acl-owner">Owner: {acl.owner}</span>
        ) : null}
        {acl?.group ? (
          <span className="fo-acl-group">Group: {acl.group}</span>
        ) : null}
      </div>

      <table className="fo-acl-matrix" role="grid">
        <thead>
          <tr>
            <th />
            <th scope="col">Read</th>
            <th scope="col">Write</th>
            <th scope="col">Execute</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.principal}>
              <th scope="row" className="fo-acl-principal">
                {entry.principal}
              </th>
              <td>
                <Checkbox
                  checked={entry.read}
                  onChange={(v) => togglePermission(entry.principal, "read", v)}
                  label={`${entry.principal} read`}
                />
              </td>
              <td>
                <Checkbox
                  checked={entry.write}
                  onChange={(v) =>
                    togglePermission(entry.principal, "write", v)
                  }
                  label={`${entry.principal} write`}
                />
              </td>
              <td>
                <Checkbox
                  checked={entry.execute}
                  onChange={(v) =>
                    togglePermission(entry.principal, "execute", v)
                  }
                  label={`${entry.principal} execute`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="fo-acl-octal-row">
        <label className="fo-acl-octal-label" htmlFor="acl-octal-input">
          Octal:
        </label>
        <input
          id="acl-octal-input"
          type="text"
          className="fo-acl-octal-input"
          value={octalInput}
          maxLength={3}
          onChange={(e) => handleOctalChange(e.target.value)}
          aria-label="Permission octal notation"
        />
      </div>

      {isDirectory ? (
        <label className="fo-acl-recursive">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />
          Apply recursively
        </label>
      ) : null}

      {saveError ? <div className="fo-operation-error">{saveError}</div> : null}

      <div className="fo-acl-actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!dirty || saving || octalInput.length !== 3}
          onClick={handleSave}
        >
          {saving ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}

export { octalFromEntries, entriesFromOctal };
