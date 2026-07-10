import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";

const outputDirectory = resolve(process.cwd(), "dist");
const fromSpecifier =
  /^(\s*(?:import|export)\b[^"'\n]*\bfrom\s*)(["'])(\.\.?\/[^"']+)\2/gm;
const bareImportSpecifier = /^(\s*import\s*)(["'])(\.\.?\/[^"']+)\2/gm;
const dynamicSpecifier = /(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g;

function outputFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? outputFiles(path) : [path];
  });
}

function resolvedSpecifier(file, specifier) {
  if (extname(specifier)) return specifier;
  if (existsSync(resolve(dirname(file), `${specifier}.js`))) {
    return `${specifier}.js`;
  }
  if (existsSync(resolve(dirname(file), specifier, "index.js"))) {
    return `${specifier.replace(/\/$/, "")}/index.js`;
  }
  throw new Error(
    `Cannot resolve emitted ESM specifier ${specifier} from ${file}`,
  );
}

for (const file of outputFiles(outputDirectory).filter((path) =>
  path.endsWith(".js"),
)) {
  const source = readFileSync(file, "utf8");
  const rewritten = source
    .replace(fromSpecifier, (match, prefix, quote, specifier) =>
      match.replace(
        `${quote}${specifier}${quote}`,
        `${quote}${resolvedSpecifier(file, specifier)}${quote}`,
      ),
    )
    .replace(bareImportSpecifier, (match, prefix, quote, specifier) =>
      match.replace(
        `${quote}${specifier}${quote}`,
        `${quote}${resolvedSpecifier(file, specifier)}${quote}`,
      ),
    )
    .replace(dynamicSpecifier, (match, prefix, quote, specifier) =>
      match.replace(
        `${quote}${specifier}${quote}`,
        `${quote}${resolvedSpecifier(file, specifier)}${quote}`,
      ),
    );
  if (rewritten !== source) writeFileSync(file, rewritten);
}
