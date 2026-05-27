import { useState, useMemo, useRef } from "react";
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
  onExecute: (results: RenameResult[]) => void;
}

export function MultiRenameDialog({
  open,
  entries,
  onClose,
  onExecute,
}: MultiRenameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  const [pattern, setPattern] = useState("[N]");
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseConversion, setCaseConversion] = useState<CaseConversion>("none");
  const [counterStart, setCounterStart] = useState(1);
  const [counterStep, setCounterStep] = useState(1);
  const [counterPadding, setCounterPadding] = useState(0);

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

  const handleExecute = () => {
    if (hasConflicts || !hasChanges) return;
    onExecute(results);
    onClose();
  };

  const insertToken = (token: string) => {
    setPattern((prev) => prev + token);
  };

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-multi-rename-dialog"
        aria-labelledby="multi-rename-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div className="fo-dialog-titleblock">
            <h2 id="multi-rename-title">Multi-Rename</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
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
        <footer className="fo-dialog-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExecute}
            disabled={hasConflicts || !hasChanges}
          >
            Rename {results.length} files
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
