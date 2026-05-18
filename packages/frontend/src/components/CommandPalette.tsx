import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchInput, cx } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { matchCommand, type CommandItem } from "../utils/matchCommand";

export interface CommandEntry extends CommandItem {
  id: string;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandEntry[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CommandPalette({
  open,
  commands,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands.filter((cmd) =>
      matchCommand(query, {
        label: cmd.label,
        shortcutKey: cmd.shortcutKey,
        category: cmd.category,
      }),
    );
  }, [query, commands]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (event.key === "Enter" && filtered.length > 0) {
        handleSelect(filtered[activeIndex].id);
      }
    },
    [filtered, activeIndex, handleSelect],
  );

  if (!open) return null;

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        className="fo-dialog fo-command-palette"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="fo-command-palette-input">
          <SearchInput
            ref={inputRef}
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
        </div>
        <ul className="fo-command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="fo-command-palette-empty">No matching commands</li>
          ) : (
            filtered.map((cmd, idx) => (
              <li
                key={cmd.id}
                role="option"
                className={cx(
                  "fo-command-palette-item",
                  idx === activeIndex && "fo-command-palette-item-active",
                )}
                onClick={() => handleSelect(cmd.id)}
              >
                <span className="fo-command-palette-label">{cmd.label}</span>
                {cmd.shortcutKey && (
                  <kbd className="fo-command-palette-shortcut">
                    {cmd.shortcutKey}
                  </kbd>
                )}
              </li>
            ))
          )}
        </ul>
      </dialog>
    </div>
  );
}
