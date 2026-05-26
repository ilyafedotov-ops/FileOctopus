import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type FileTag,
  type TagColor,
  tagColorValues,
  loadTags,
  saveTags,
  addTagToEntry as addTag,
  removeTagFromEntry as removeTag,
  getTagColorsForEntry as getColors,
} from "../utils/tagStore";

interface TagContextValue {
  tags: FileTag[];
  tagColorsForEntry: (uri: string) => TagColor[];
  assignTag: (uri: string, color: TagColor, label: string) => void;
  removeTag: (uri: string, color: TagColor) => void;
  allColors: TagColor[];
}

const TagContext = createContext<TagContextValue | null>(null);

export function TagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<FileTag[]>(() => loadTags());

  const tagColorsForEntry = useCallback(
    (uri: string) => getColors(tags, uri),
    [tags],
  );

  const assignTag = useCallback(
    (uri: string, color: TagColor, label: string) => {
      setTags((prev) => {
        const next = addTag(prev, { uri, color, label });
        saveTags(next);
        return next;
      });
    },
    [],
  );

  const removeTagAction = useCallback((uri: string, color: TagColor) => {
    setTags((prev) => {
      const next = removeTag(prev, uri, color);
      saveTags(next);
      return next;
    });
  }, []);

  return (
    <TagContext.Provider
      value={{
        tags,
        tagColorsForEntry,
        assignTag,
        removeTag: removeTagAction,
        allColors: tagColorValues,
      }}
    >
      {children}
    </TagContext.Provider>
  );
}

export function useTags(): TagContextValue {
  const ctx = useContext(TagContext);
  if (!ctx) {
    return {
      tags: [],
      tagColorsForEntry: () => [],
      assignTag: () => {},
      removeTag: () => {},
      allColors: tagColorValues,
    };
  }
  return ctx;
}
