export interface SmartFolder {
  id: string;
  name: string;
  baseUri: string;
  query: string;
}

export const SMART_FOLDERS_KEY = "fo-smart-folders";

export function loadSmartFolders(): SmartFolder[] {
  try {
    const raw = localStorage.getItem(SMART_FOLDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SmartFolder[];
  } catch {
    return [];
  }
}

export function saveSmartFolders(folders: SmartFolder[]): void {
  localStorage.setItem(SMART_FOLDERS_KEY, JSON.stringify(folders));
}

export function addSmartFolder(folder: Omit<SmartFolder, "id">): SmartFolder {
  const folders = loadSmartFolders();
  const id =
    "sf-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 6);
  const entry: SmartFolder = { ...folder, id };
  folders.push(entry);
  saveSmartFolders(folders);
  return entry;
}

export function removeSmartFolder(id: string): void {
  const folders = loadSmartFolders();
  const filtered = folders.filter((f) => f.id !== id);
  if (filtered.length !== folders.length) {
    saveSmartFolders(filtered);
  }
}

export function renameSmartFolder(id: string, name: string): void {
  const folders = loadSmartFolders();
  const target = folders.find((f) => f.id === id);
  if (target) {
    target.name = name;
    saveSmartFolders(folders);
  }
}
