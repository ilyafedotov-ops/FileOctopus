export type FileTypeMatchType = "extension" | "name" | "pattern";

export interface FileTypeColorRule {
  id: string;
  name: string;
  pattern: string;
  matchType: FileTypeMatchType;
  color: string;
  enabled: boolean;
}

export const DEFAULT_FILE_TYPE_COLORS: FileTypeColorRule[] = [
  {
    id: "images",
    name: "Images",
    pattern: "jpg,jpeg,png,gif,bmp,webp,svg,ico,tiff,tif",
    matchType: "extension",
    color: "#4ec9b0",
    enabled: true,
  },
  {
    id: "videos",
    name: "Videos",
    pattern: "mp4,avi,mkv,mov,wmv,flv,webm,m4v,mpg,mpeg",
    matchType: "extension",
    color: "#b180d7",
    enabled: true,
  },
  {
    id: "audio",
    name: "Audio",
    pattern: "mp3,wav,flac,aac,ogg,m4a,wma,aiff",
    matchType: "extension",
    color: "#dcdcaa",
    enabled: true,
  },
  {
    id: "archives",
    name: "Archives",
    pattern: "zip,tar,gz,bz2,7z,rar,xz,tgz,tbz2,zst",
    matchType: "extension",
    color: "#ce9178",
    enabled: true,
  },
  {
    id: "executables",
    name: "Executables",
    pattern: "exe,bat,cmd,sh,bash,ps1,msi,app,dmg,deb,rpm",
    matchType: "extension",
    color: "#f14c4c",
    enabled: true,
  },
  {
    id: "code",
    name: "Code",
    pattern: "js,ts,jsx,tsx,py,rs,go,java,c,cpp,h,hpp,cs,rb,php,swift,kt",
    matchType: "extension",
    color: "#3794ff",
    enabled: true,
  },
  {
    id: "configs",
    name: "Config files",
    pattern: "json,yaml,yml,toml,ini,conf,cfg,env,xml,properties",
    matchType: "extension",
    color: "#8b95a8",
    enabled: true,
  },
  {
    id: "documents",
    name: "Documents",
    pattern: "pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,rtf,odt,ods,odp",
    matchType: "extension",
    color: "#4ec9b0",
    enabled: true,
  },
];

export function matchFileTypeColor(
  fileName: string,
  rules: FileTypeColorRule[],
): string | null {
  const lowerName = fileName.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");
  const extension = dotIndex > 0 ? lowerName.slice(dotIndex + 1) : "";

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let matches = false;

    switch (rule.matchType) {
      case "extension": {
        const extensions = rule.pattern
          .toLowerCase()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        matches = extensions.includes(extension);
        break;
      }
      case "name": {
        const patterns = rule.pattern
          .toLowerCase()
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        matches = patterns.some((pattern) => {
          if (pattern.startsWith("*")) {
            return lowerName.endsWith(pattern.slice(1));
          }
          if (pattern.endsWith("*")) {
            return lowerName.startsWith(pattern.slice(0, -1));
          }
          return lowerName === pattern;
        });
        break;
      }
      case "pattern": {
        try {
          const regex = new RegExp(rule.pattern, "i");
          matches = regex.test(fileName);
        } catch {
          matches = false;
        }
        break;
      }
    }

    if (matches) {
      return rule.color;
    }
  }

  return null;
}

export function parseFileTypeColorRules(json: string): FileTypeColorRule[] {
  if (!json) return DEFAULT_FILE_TYPE_COLORS;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r): r is FileTypeColorRule =>
          typeof r === "object" &&
          r !== null &&
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          typeof r.pattern === "string" &&
          typeof r.matchType === "string" &&
          typeof r.color === "string" &&
          typeof r.enabled === "boolean",
      );
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_FILE_TYPE_COLORS;
}

export function serializeFileTypeColorRules(
  rules: FileTypeColorRule[],
): string {
  return JSON.stringify(rules);
}
