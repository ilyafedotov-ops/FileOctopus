export interface CommandItem {
  label: string;
  shortcutKey?: string;
  category?: string;
}

export function matchCommand(query: string, item: CommandItem): boolean {
  if (!query) return true;

  const q = query.toLowerCase();

  const haystack = [item.label, item.shortcutKey ?? "", item.category ?? ""]
    .join(" ")
    .toLowerCase();

  // Substring match first
  if (haystack.indexOf(q) !== -1) return true;

  // Fuzzy match: each query char must appear in order
  let hayIdx = 0;
  for (const ch of q) {
    const found = haystack.indexOf(ch, hayIdx);
    if (found === -1) return false;
    hayIdx = found + 1;
  }

  return true;
}
