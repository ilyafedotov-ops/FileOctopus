import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["packages/ts-api", "packages/ui", "packages/frontend"];

for (const packageDirectory of packages) {
  const directory = resolve(root, packageDirectory);
  const manifest = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  const rootExport = manifest.exports?.["."];
  for (const field of ["types", "import", "default"]) {
    const target = rootExport?.[field];
    if (typeof target !== "string" || !target.startsWith("./dist/")) {
      throw new Error(`${manifest.name} ${field} export must resolve from dist`);
    }
    await access(resolve(directory, target));
  }
  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (subpath === ".") continue;
    const target = typeof value === "string" ? value : value.default;
    if (typeof target !== "string" || !target.startsWith("./dist/")) {
      throw new Error(`${manifest.name} ${subpath} must resolve from dist`);
    }
    await access(resolve(directory, target));
  }
}

await import(
  pathToFileURL(resolve(root, "packages/ts-api/dist/index.js")).href
);
