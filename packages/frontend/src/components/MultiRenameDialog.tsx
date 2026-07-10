import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  applyRenamePattern,
  PATTERN_TOKENS,
  type CaseConversion,
  type MultiRenameOptions,
  type RenameResult,
} from "../utils/multiRename";

interface MultiRenameDialogProps {
  open: boolean;
  entries: FileEntryDto[];
  onClose: () => void;
  onExecute: (results: RenameResult[]) => Promise<string | null>;
}

export function MultiRenameDialog({
  open,
  entries,
  onClose,
  onExecute,
}: MultiRenameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  useDialogEscape(open && !executing, onClose);
  useFocusTrap(dialogRef, open);

  const [pattern, setPattern] = useState("[N]");
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseConversion, setCaseConversion] = useState<CaseConversion>("none");
  const [counterStart, setCounterStart] = useState(1);
  const [counterStep, setCounterStep] = useState(1);
  const [counterPadding, setCounterPadding] = useState(0);

  useEffect(() => {
    if (open) {
      setExecutionError(null);
    }
  }, [open]);

  const names = useMemo(() => entries.map((e) => e.name), [entries]);

  const results = useMemo(() => {
    const options: MultiRenameOptions = {
      pattern,
      search: search || undefined,
      replace: replace || undefined,
      useRegex,
      caseConversion,
      counterStart,
      counterStep,
      counterPadding,
    };
    return applyRenamePattern(names, options);
  }, [
    names,
    pattern,
    search,
    replace,
    useRegex,
    caseConversion,
    counterStart,
    counterStep,
    counterPadding,
  ]);

  const hasConflicts = results.some((r) => r.hasConflict);
  const hasChanges = results.some((r) => r.originalName !== r.newName);

  if (!open) {
    return null;
  }

  const handleExecute = async () => {
    if (hasConflicts || !hasChanges || executing) return;
    setExecuting(true);
    setExecutionError(null);
    try {
      const error = await onExecute(results);
      if (error) {
        setExecutionError(error);
      } else {
        onClose();
      }
    } catch (error) {
      setExecutionError(
        error instanceof Error ? error.message : "Multi-rename failed.",
      );
    } finally {
      setExecuting(false);
    }
  };

  const insertToken = (token: string) => {
    setPattern((prev) => prev + token);
  };

  return (
    <div
      className="fo-dialog-backdrop"
      role="presentation"
      onClick={() => {
        if (!executing) onClose();
      }}
    >
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-multi-rename-dialog"
        aria-labelledby="multi-rename-title"
        aria-busy={executing}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div className="fo-dialog-titleblock">
            <h2 id="multi-rename-title">Multi-Rename</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={executing}
          >
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <div className="fo-multi-rename-form">
            <label className="fo-dialog-field">
              <span>Pattern</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="[N]"
              />
            </label>
            <div className="fo-multi-rename-tokens">
              {PATTERN_TOKENS.map((t) => (
                <Button
                  key={t.token}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => insertToken(t.token)}
                  title={t.description}
                >
                  {t.token}
                </Button>
              ))}
            </div>
            <label className="fo-dialog-field">
              <span>Search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search text or regex"
              />
            </label>
            <label className="fo-dialog-field">
              <span>Replace</span>
              <input
                type="text"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="Replacement text"
              />
            </label>
            <label className="fo-settings-checkbox">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              <span>Use regular expressions</span>
            </label>
            <label className="fo-dialog-field">
              <span>Case conversion</span>
              <select
                value={caseConversion}
                onChange={(e) =>
                  setCaseConversion(e.target.value as CaseConversion)
                }
              >
                <option value="none">None</option>
                <option value="upper">UPPERCASE</option>
                <option value="lower">lowercase</option>
                <option value="title">Title Case</option>
                <option value="sentence">Sentence case</option>
                <option value="camel">camelCase</option>
                <option value="snake">snake_case</option>
              </select>
            </label>
            <div className="fo-multi-rename-counter">
              <label className="fo-dialog-field">
                <span>Counter start</span>
                <input
                  type="number"
                  value={counterStart}
                  onChange={(e) =>
                    setCounterStart(parseInt(e.target.value, 10) || 1)
                  }
                  min={0}
                />
              </label>
              <label className="fo-dialog-field">
                <span>Counter step</span>
                <input
                  type="number"
                  value={counterStep}
                  onChange={(e) =>
                    setCounterStep(parseInt(e.target.value, 10) || 1)
                  }
                  min={1}
                />
              </label>
              <label className="fo-dialog-field">
                <span>Counter padding</span>
                <input
                  type="number"
                  value={counterPadding}
                  onChange={(e) =>
                    setCounterPadding(parseInt(e.target.value, 10) || 0)
                  }
                  min={0}
                />
              </label>
            </div>
          </div>
          <div className="fo-multi-rename-preview">
            <h3>Preview ({entries.length} files)</h3>
            {hasConflicts && (
              <div className="fo-multi-rename-conflict-warning">
                Conflicts detected! Please adjust the pattern.
              </div>
            )}
            <div className="fo-multi-rename-results">
              <table>
                <thead>
                  <tr>
                    <th>Original</th>
                    <th>New name</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        r.hasConflict
                          ? "fo-multi-rename-conflict"
                          : r.originalName !== r.newName
                            ? "fo-multi-rename-changed"
                            : ""
                      }
                    >
                      <td>{r.originalName}</td>
                      <td>{r.newName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {executionError && (
          <div className="fo-dialog-error" role="alert">
            {executionError}
          </div>
        )}
        <footer className="fo-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={executing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleExecute()}
            disabled={hasConflicts || !hasChanges || executing}
          >
            {executing ? "Starting…" : `Rename ${results.length} files`}
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
