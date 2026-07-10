import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLATFORM_EXTENSIONS = new Map([
  ["macos-arm64", new Set([".dmg"])],
  ["macos-x64", new Set([".dmg"])],
  ["windows-x64", new Set([".msi", ".exe"])],
  ["linux-x64", new Set([".AppImage", ".deb", ".rpm"])],
]);

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const RELEASE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

export function versionFromTag(tag) {
  if (typeof tag !== "string" || !tag.startsWith("v")) {
    throw new Error("release tag must start with v");
  }
  const version = tag.slice(1);
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error("release tag must contain a valid semantic version");
  }
  return version;
}

export function cargoWorkspaceVersion(source) {
  let inWorkspacePackage = false;
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inWorkspacePackage = trimmed === "[workspace.package]";
      continue;
    }
    if (inWorkspacePackage) {
      const match = /^version\s*=\s*"([^"]+)"\s*$/u.exec(trimmed);
      if (match) {
        return match[1];
      }
    }
  }
  throw new Error("Cargo workspace version is missing");
}

export function validateReleaseIdentity({
  tag,
  requestedSha,
  workflowSha,
  workflowRef,
  packageVersion,
  cargoVersion,
  tauriVersion,
}) {
  const version = versionFromTag(tag);
  if (!SHA_PATTERN.test(requestedSha)) {
    throw new Error("requested commit must be a full lowercase commit SHA");
  }
  if (workflowRef !== "refs/heads/main") {
    throw new Error("prereleases must be dispatched from protected main");
  }
  if (workflowSha !== requestedSha) {
    throw new Error("requested commit must match the workflow commit");
  }
  const versions = [packageVersion, cargoVersion, tauriVersion];
  if (versions.some((candidate) => candidate !== version)) {
    throw new Error("tag and repository versions do not match exactly");
  }
  return version;
}

async function filesUnder(directory) {
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error(`artifact path is not a directory: ${directory}`);
  }
  const files = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(current, entry.name);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) {
        throw new Error(`symbolic links are not release artifacts: ${path}`);
      }
      if (metadata.isDirectory()) {
        await visit(path);
      } else if (metadata.isFile()) {
        files.push(path);
      } else {
        throw new Error(`unsupported release artifact type: ${path}`);
      }
    }
  };
  await visit(directory);
  return files;
}

async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function stageReleaseArtifacts({
  artifactsDirectory,
  releaseDirectory,
  version,
  commitSha,
}) {
  versionFromTag(`v${version}`);
  if (!SHA_PATTERN.test(commitSha)) {
    throw new Error(
      "release manifest commit must be a full lowercase commit SHA",
    );
  }
  await rm(releaseDirectory, { recursive: true, force: true });
  await mkdir(releaseDirectory, { recursive: true });
  const assets = [];
  for (const [platform, allowedExtensions] of PLATFORM_EXTENSIONS) {
    const sourceDirectory = join(artifactsDirectory, `release-${platform}`);
    const files = await filesUnder(sourceDirectory);
    if (files.length === 0) {
      throw new Error(`release artifact set is empty: ${platform}`);
    }
    const extensions = new Set();
    for (const sourcePath of files) {
      const extension = extname(sourcePath);
      if (!allowedExtensions.has(extension)) {
        throw new Error(
          `unexpected ${platform} artifact extension: ${extension || "none"}`,
        );
      }
      if (extensions.has(extension)) {
        throw new Error(
          `duplicate ${platform} artifact extension: ${extension}`,
        );
      }
      const metadata = await stat(sourcePath);
      if (metadata.size === 0) {
        throw new Error(`release artifact is empty: ${sourcePath}`);
      }
      extensions.add(extension);
      const stagedName = `FileOctopus-${version}-${platform}${extension}`;
      const stagedPath = join(releaseDirectory, stagedName);
      await copyFile(sourcePath, stagedPath);
      assets.push({
        platform,
        name: stagedName,
        originalName: basename(sourcePath),
        sha256: await digest(stagedPath),
        size: metadata.size,
      });
    }
  }
  assets.sort((left, right) => left.name.localeCompare(right.name));
  const manifestName = `FileOctopus-${version}-manifest.json`;
  await writeFile(
    join(releaseDirectory, manifestName),
    `${JSON.stringify({ version, commitSha, assets }, null, 2)}\n`,
    "utf8",
  );
  return { assets, manifestName };
}

export async function writeReleaseChecksums({
  releaseDirectory,
  extraFiles = [],
  outputPath,
}) {
  await rm(outputPath, { force: true });
  const releaseFiles = await filesUnder(releaseDirectory);
  const files = [...releaseFiles, ...extraFiles];
  const names = new Set();
  const entries = [];
  for (const path of files) {
    const metadata = await lstat(path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size === 0
    ) {
      throw new Error(
        `checksum input must be a non-empty regular file: ${path}`,
      );
    }
    const name = basename(path);
    if (!RELEASE_NAME_PATTERN.test(name)) {
      throw new Error(`unsafe release artifact name: ${name}`);
    }
    if (names.has(name)) {
      throw new Error(`duplicate release artifact name: ${name}`);
    }
    names.add(name);
    entries.push({ name, sha256: await digest(path) });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  await writeFile(
    outputPath,
    entries.map((entry) => `${entry.sha256}  ${entry.name}\n`).join(""),
    "utf8",
  );
  return entries;
}

async function repositoryVersions(root) {
  const packageJson = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const tauriConfig = JSON.parse(
    await readFile(
      join(root, "apps/desktop-tauri/src-tauri/tauri.conf.json"),
      "utf8",
    ),
  );
  const cargoSource = await readFile(join(root, "Cargo.toml"), "utf8");
  return {
    packageVersion: packageJson.version,
    cargoVersion: cargoWorkspaceVersion(cargoSource),
    tauriVersion: tauriConfig.version,
  };
}

async function main() {
  const command = process.argv[2];
  const root = process.cwd();
  if (command === "identity") {
    const versions = await repositoryVersions(root);
    const version = validateReleaseIdentity({
      tag: process.env.RELEASE_TAG,
      requestedSha: process.env.REQUESTED_SHA,
      workflowSha: process.env.WORKFLOW_SHA,
      workflowRef: process.env.WORKFLOW_REF,
      ...versions,
    });
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error("GITHUB_OUTPUT is required");
    }
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\n`, "utf8");
    return;
  }
  if (command === "stage") {
    await stageReleaseArtifacts({
      artifactsDirectory: resolve(process.env.ARTIFACTS_DIR || "artifacts"),
      releaseDirectory: resolve(process.env.RELEASE_DIR || "release"),
      version: process.env.RELEASE_VERSION,
      commitSha: process.env.REQUESTED_SHA,
    });
    return;
  }
  if (command === "checksums") {
    await writeReleaseChecksums({
      releaseDirectory: resolve(process.env.RELEASE_DIR || "release"),
      extraFiles: process.env.SBOM_PATH ? [resolve(process.env.SBOM_PATH)] : [],
      outputPath: resolve(process.env.CHECKSUM_PATH || "SHA256SUMS"),
    });
    return;
  }
  throw new Error("expected identity, stage, or checksums command");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
