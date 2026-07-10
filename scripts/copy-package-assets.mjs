import { copyFile, cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

for (const mapping of process.argv.slice(2)) {
  const separator = mapping.indexOf(":");
  if (separator < 1 || separator === mapping.length - 1) {
    throw new Error(`invalid asset mapping: ${mapping}`);
  }
  const source = resolve(process.cwd(), mapping.slice(0, separator));
  const destination = resolve(process.cwd(), mapping.slice(separator + 1));
  if ((await stat(source)).isDirectory()) {
    await cp(source, destination, { recursive: true });
    continue;
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
