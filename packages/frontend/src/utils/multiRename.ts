export type CaseConversion =
  "none" | "upper" | "lower" | "title" | "sentence" | "camel" | "snake";

export interface MultiRenameOptions {
  pattern: string;
  search?: string;
  replace?: string;
  useRegex?: boolean;
  caseConversion?: CaseConversion;
  counterStart?: number;
  counterStep?: number;
  counterPadding?: number;
}

export interface RenameResult {
  originalName: string;
  newName: string;
  hasConflict: boolean;
}

export function applyRenamePattern(
  names: string[],
  options: MultiRenameOptions,
): RenameResult[] {
  const {
    pattern,
    search,
    replace,
    useRegex = false,
    caseConversion = "none",
    counterStart = 1,
    counterStep = 1,
    counterPadding = 0,
  } = options;

  const results: RenameResult[] = [];
  const newNames = new Set<string>();
  let counter = counterStart;

  for (const originalName of names) {
    const dotIndex = originalName.lastIndexOf(".");
    const nameWithoutExt =
      dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
    const extension = dotIndex > 0 ? originalName.slice(dotIndex + 1) : "";

    let newName = pattern;

    newName = newName.replace(/\[N\]/g, nameWithoutExt);
    newName = newName.replace(/\[E\]/g, extension);

    const counterStr = String(counter).padStart(counterPadding, "0");
    newName = newName.replace(/\[C\]/g, counterStr);
    newName = newName.replace(
      /\[C:(\d+):(\d+):(\d+)\]/g,
      (_, pad, start, step) => {
        const p = parseInt(pad, 10);
        const s = parseInt(start, 10);
        const st = parseInt(step, 10);
        const val = s + Math.floor((counter - counterStart) / counterStep) * st;
        return String(val).padStart(p, "0");
      },
    );

    const now = new Date();
    newName = newName.replace(/\[Y\]/g, String(now.getFullYear()));
    newName = newName.replace(
      /\[M\]/g,
      String(now.getMonth() + 1).padStart(2, "0"),
    );
    newName = newName.replace(/\[D\]/g, String(now.getDate()).padStart(2, "0"));

    if (search) {
      if (useRegex) {
        try {
          const regex = new RegExp(search, "g");
          newName = newName.replace(regex, replace ?? "");
        } catch {
          // invalid regex, skip
        }
      } else {
        newName = newName.split(search).join(replace ?? "");
      }
    }

    newName = applyCaseConversion(newName, caseConversion);

    if (extension && !newName.includes(".")) {
      newName = `${newName}.${extension}`;
    }

    const hasConflict = newNames.has(newName);
    newNames.add(newName);

    results.push({
      originalName,
      newName,
      hasConflict,
    });

    counter += counterStep;
  }

  return results;
}

function applyCaseConversion(str: string, conversion: CaseConversion): string {
  switch (conversion) {
    case "upper":
      return str.toUpperCase();
    case "lower":
      return str.toLowerCase();
    case "title":
      return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
      );
    case "sentence":
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    case "camel":
      return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
    case "snake":
      return str
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "")
        .replace(/[^a-z0-9]+/g, "_");
    case "none":
    default:
      return str;
  }
}

export const PATTERN_TOKENS = [
  { token: "[N]", description: "Original name (without extension)" },
  { token: "[E]", description: "Extension" },
  { token: "[C]", description: "Counter" },
  {
    token: "[C:pad:start:step]",
    description: "Counter with padding, start, and step",
  },
  { token: "[Y]", description: "Year (4-digit)" },
  { token: "[M]", description: "Month (2-digit)" },
  { token: "[D]", description: "Day (2-digit)" },
];
