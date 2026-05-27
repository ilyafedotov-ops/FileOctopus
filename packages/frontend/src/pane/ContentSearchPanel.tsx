import { useEffect, useRef, useState, type ReactElement } from "react";
import { SearchInput } from "@fileoctopus/ui";
import type {
  ContentSearchMatchDto,
  ContentSearchResultDto,
  FileEntryDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { fileIconGlyph } from "./fileTableUtils";
import { localPathFromUri, searchMatchToEntry } from "../utils/paneUtils";

export interface ContentSearchInputProps {
  panelId: PanelId;
  active: boolean;
  value: string;
  focusToken: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function ContentSearchInput({
  panelId,
  active,
  value,
  focusToken,
  onChange,
  onSubmit,
}: ContentSearchInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (active && focusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [active, focusToken]);

  return (
    <SearchInput
      ref={inputRef}
      className="fo-content-search"
      aria-label={`${panelId} content search`}
      value={value}
      placeholder="Search in file contents…"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

export interface ContentSearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  filePattern: string;
}

export interface ContentSearchState {
  panelId: PanelId;
  query: string;
  options: ContentSearchOptions;
  running: boolean;
  jobId: string | null;
  result: ContentSearchResultDto | null;
  error: string | null;
}

export interface ContentSearchPanelProps {
  panelId: PanelId;
  search: ContentSearchState | null;
  onOpen: (entry: FileEntryDto, match: ContentSearchMatchDto) => void;
  onReveal: (entry: FileEntryDto) => void;
}

export function ContentSearchPanel({
  search,
  onOpen,
  onReveal,
}: ContentSearchPanelProps) {
  const [expandedUri, setExpandedUri] = useState<string | null>(null);

  if (!search) {
    return null;
  }

  const matches = search.result?.matches ?? [];
  const groupedByFile = groupMatchesByFile(matches);

  return (
    <section
      className="fo-search-results fo-content-search-results"
      aria-label="Content search results"
    >
      <header>
        <strong>
          {search.running
            ? "Searching"
            : `${matches.length} match(es) in ${groupedByFile.size} file(s)`}
        </strong>
        {search.error ? <span>{search.error}</span> : null}
      </header>
      {matches.length === 0 && !search.running ? (
        <div className="fo-empty-inline">No content matches</div>
      ) : null}
      {Array.from(groupedByFile.entries())
        .slice(0, 50)
        .map(([uri, fileMatches]) => {
          const firstMatch = fileMatches[0];
          const entry = searchMatchToEntry({
            uri: firstMatch.uri,
            parentUri: firstMatch.parentUri,
            name: firstMatch.name,
            kind: firstMatch.kind,
            size: firstMatch.size,
            modifiedAt: firstMatch.modifiedAt,
          });
          const isExpanded = expandedUri === uri;

          return (
            <div key={uri} className="fo-content-search-file">
              <div
                className="fo-content-search-file-header"
                onClick={() => setExpandedUri(isExpanded ? null : uri)}
              >
                <span className="fo-content-search-file-icon">
                  {fileIconGlyph(entry)}
                </span>
                <span className="fo-content-search-file-name">
                  {firstMatch.name}
                </span>
                <span className="fo-content-search-file-path">
                  {localPathFromUri(firstMatch.parentUri)}
                </span>
                <span className="fo-content-search-file-count">
                  {fileMatches.length} match
                  {fileMatches.length !== 1 ? "es" : ""}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(entry, firstMatch);
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReveal(entry);
                  }}
                >
                  Reveal
                </button>
              </div>
              {isExpanded && (
                <div className="fo-content-search-matches">
                  {fileMatches.map((match, idx) => (
                    <div
                      key={`${uri}:${match.lineNumber}:${idx}`}
                      className="fo-content-search-match"
                      onClick={() => onOpen(entry, match)}
                    >
                      <span className="fo-content-search-line-number">
                        {match.lineNumber}
                      </span>
                      <span className="fo-content-search-line-content">
                        {highlightMatch(
                          match.lineContent,
                          match.matchStart,
                          match.matchEnd,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

function groupMatchesByFile(
  matches: ContentSearchMatchDto[],
): Map<string, ContentSearchMatchDto[]> {
  const map = new Map<string, ContentSearchMatchDto[]>();
  for (const match of matches) {
    const existing = map.get(match.uri);
    if (existing) {
      existing.push(match);
    } else {
      map.set(match.uri, [match]);
    }
  }
  return map;
}

function highlightMatch(
  line: string,
  start: number,
  end: number,
): ReactElement {
  const before = line.slice(0, start);
  const match = line.slice(start, end);
  const after = line.slice(end);

  return (
    <>
      {before}
      <mark className="fo-content-search-highlight">{match}</mark>
      {after}
    </>
  );
}
