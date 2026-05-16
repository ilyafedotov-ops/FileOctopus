import { useEffect, useRef } from "react";
import { SearchInput } from "@fileoctopus/ui";
import type {
  FileEntryDto,
  RecursiveSearchResultDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { fileIconGlyph } from "./fileTableUtils";
import { localPathFromUri, searchMatchToEntry } from "../utils/paneUtils";

export interface FilterInputProps {
  panelId: PanelId;
  value: string;
  focusToken: number;
  onChange: (value: string) => void;
}

export function FilterInput({
  panelId,
  value,
  focusToken,
  onChange,
}: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusToken]);

  return (
    <SearchInput
      ref={inputRef}
      className="fo-filter"
      aria-label={`${panelId} filter`}
      value={value}
      placeholder="Filter current folder…"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface SearchState {
  panelId: PanelId;
  query: string;
  running: boolean;
  jobId: string | null;
  result: RecursiveSearchResultDto | null;
  error: string | null;
}

export interface RecursiveSearchPanelProps {
  panelId: PanelId;
  search: SearchState | null;
  onOpen: (entry: FileEntryDto) => void;
  onReveal: (entry: FileEntryDto) => void;
  onProperties: (entry: FileEntryDto) => void;
}

export function RecursiveSearchPanel({
  search,
  onOpen,
  onReveal,
  onProperties,
}: RecursiveSearchPanelProps) {
  if (!search) {
    return null;
  }

  const matches = search.result?.matches ?? [];

  return (
    <section
      className="fo-search-results"
      aria-label="Recursive search results"
    >
      <header>
        <strong>
          {search.running ? "Searching" : `${matches.length} result(s)`}
        </strong>
        {search.error ? <span>{search.error}</span> : null}
      </header>
      {matches.length === 0 && !search.running ? (
        <div className="fo-empty-inline">No recursive matches</div>
      ) : null}
      {matches.slice(0, 50).map((match) => {
        const entry = searchMatchToEntry(match);

        return (
          <div className="fo-search-row" key={match.uri}>
            <span>
              {fileIconGlyph(entry)} {match.name}
            </span>
            <span>{localPathFromUri(match.parentUri)}</span>
            <button type="button" onClick={() => onOpen(entry)}>
              Open
            </button>
            <button type="button" onClick={() => onReveal(entry)}>
              Reveal
            </button>
            <button type="button" onClick={() => onProperties(entry)}>
              Properties
            </button>
          </div>
        );
      })}
      {search.result?.incomplete ? (
        <div className="fo-empty-inline">
          Some folders could not be searched.
        </div>
      ) : null}
    </section>
  );
}
